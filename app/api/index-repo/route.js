import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../lib/db";
import { getRepo, getRepoTree, getFileContent, isIndexableFile } from "../../../lib/github";
import { chunkFile } from "../../../lib/chunk";
import { embedTexts, toVectorLiteral } from "../../../lib/embeddings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Caps keep indexing snappy, responsive, and well within serverless execution limits.
// Non-indexed files remain fully accessible through Just-In-Time (JIT) on-demand retrieval.
const MAX_FILES = 80;
const MAX_CHUNKS = 500;
const DOWNLOAD_CONCURRENCY = 15;
const DB_BATCH_SIZE = 25;

function getFilePriority(filePath) {
  const lower = filePath.toLowerCase();
  const filename = lower.split("/").pop();

  // Low priority: test suites, mocks, fixtures
  if (
    lower.includes(".test.") ||
    lower.includes(".spec.") ||
    lower.includes("_test.") ||
    lower.includes("/tests/") ||
    lower.includes("/__tests__/") ||
    lower.includes("/fixtures/") ||
    lower.includes("/mock/") ||
    lower.includes("/mocks/")
  ) {
    return 10;
  }

  // Low priority: static assets, styling, secondary configs
  if (
    lower.endsWith(".json") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".toml") ||
    lower.endsWith(".xml") ||
    lower.endsWith(".svg") ||
    lower.endsWith(".css") ||
    lower.endsWith(".scss") ||
    lower.endsWith(".html") ||
    lower.endsWith(".htm")
  ) {
    return 20;
  }

  // Secondary documentation
  if (lower.endsWith(".md") || lower.endsWith(".mdx") || lower.endsWith(".txt")) {
    if (filename === "readme.md") return 95; // README is vital for architecture overview
    return 15;
  }

  // Core entrypoints and configuration manifests
  if (
    filename === "main.go" ||
    filename === "app.js" ||
    filename === "index.js" ||
    filename === "index.ts" ||
    filename === "server.js" ||
    filename === "server.ts" ||
    filename === "main.py" ||
    filename === "app.py" ||
    filename === "cargo.toml" ||
    filename === "go.mod" ||
    filename === "package.json"
  ) {
    return 100;
  }

  // Core architectural folders: controllers, routes, models, services, etc.
  if (
    lower.includes("/controllers/") ||
    lower.includes("/routes/") ||
    lower.includes("/services/") ||
    lower.includes("/models/") ||
    lower.includes("/handlers/") ||
    lower.includes("/middleware/") ||
    lower.includes("/helpers/") ||
    lower.includes("/api/") ||
    lower.includes("/lib/") ||
    lower.includes("/pkg/") ||
    lower.includes("/cmd/") ||
    lower.includes("/internal/") ||
    lower.includes("/core/") ||
    lower.includes("/src/") ||
    lower.includes("/app/")
  ) {
    return 90;
  }

  // Source code files
  if (/\.(go|ts|tsx|js|jsx|py|rs|java|c|cpp|cc|h|hpp|cs|php|rb|swift|kt|dart|scala)$/.test(lower)) {
    return 80;
  }

  return 40;
}

// Concurrent worker-pool file fetcher
async function fetchFilesConcurrently(token, owner, repo, files, branch, concurrency = DOWNLOAD_CONCURRENCY) {
  const results = new Array(files.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, files.length) }, async () => {
    while (currentIndex < files.length) {
      const idx = currentIndex++;
      const entry = files[idx];
      try {
        const content = await getFileContent(token, owner, repo, entry.path, branch);
        results[idx] = { entry, content };
      } catch (err) {
        console.warn(`Failed to fetch file content for ${entry.path}:`, err.message);
        results[idx] = { entry, content: null };
      }
    }
  });

  await Promise.all(workers);
  return results;
}

// Multi-row batch insert for pgvector chunks
async function insertChunksBatch(db, repositoryId, chunks, embeddings, batchSize = DB_BATCH_SIZE) {
  for (let i = 0; i < chunks.length; i += batchSize) {
    const chunkBatch = chunks.slice(i, i + batchSize);
    const placeholders = [];
    const params = [];
    let p = 1;

    for (let j = 0; j < chunkBatch.length; j++) {
      const c = chunkBatch[j];
      const emb = embeddings[i + j];
      placeholders.push(`($${p}, $${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5})`);
      params.push(repositoryId, c.filePath, c.startLine, c.endLine, c.text, toVectorLiteral(emb));
      p += 6;
    }

    await db.query(
      `INSERT INTO chunks (repository_id, file_path, start_line, end_line, content, embedding)
       VALUES ${placeholders.join(", ")}`,
      params
    );
  }
}

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { owner, repo } = await request.json();
  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo are required" }, { status: 400 });
  }

  const db = getDb();

  try {
    const repoInfo = await getRepo(user.access_token, owner, repo);
    const branch = repoInfo.default_branch;

    const tree = await getRepoTree(user.access_token, owner, repo, branch);
    const allBlobEntries = tree; // every file in the repo, before any filtering
    const eligible = allBlobEntries.filter((entry) => isIndexableFile(entry.path, entry.size));

    // Sort eligible files by architectural importance and shallowest depth
    const sortedEligible = [...eligible].sort((a, b) => {
      const pA = getFilePriority(a.path);
      const pB = getFilePriority(b.path);
      if (pB !== pA) return pB - pA;
      const depthA = a.path.split("/").length;
      const depthB = b.path.split("/").length;
      if (depthA !== depthB) return depthA - depthB;
      return a.path.localeCompare(b.path);
    });

    const filesToIndex = sortedEligible.slice(0, MAX_FILES);

    const skippedUnsupported = allBlobEntries
      .filter((entry) => !isIndexableFile(entry.path, entry.size))
      .map((entry) => entry.path);
    const skippedOverFileCap = sortedEligible.slice(MAX_FILES).map((entry) => entry.path);

    // Upsert the repository row
    const { rows: repoRows } = await db.query(
      `INSERT INTO repositories (owner, name, user_id, default_branch)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (owner, name) DO UPDATE SET default_branch = $4, user_id = $3
       RETURNING id`,
      [owner, repo, user.id, branch]
    );
    const repositoryId = repoRows[0].id;

    // Concurrently fetch files from GitHub in batched workers
    const fetchedFiles = await fetchFilesConcurrently(
      user.access_token,
      owner,
      repo,
      filesToIndex,
      branch,
      DOWNLOAD_CONCURRENCY
    );

    // Build chunks
    const allChunks = [];
    let filesIndexed = 0;
    let hitChunkCap = false;

    for (const item of fetchedFiles) {
      if (!item || !item.content) continue;
      filesIndexed++;
      const chunks = chunkFile(item.content);
      for (const chunk of chunks) {
        allChunks.push({ filePath: item.entry.path, ...chunk });
        if (allChunks.length >= MAX_CHUNKS) {
          hitChunkCap = true;
          break;
        }
      }
      if (hitChunkCap) break;
    }

    // Re-indexing replaces old chunks wholesale
    await db.query(`DELETE FROM chunks WHERE repository_id = $1`, [repositoryId]);

    if (allChunks.length > 0) {
      // Embed chunks with file path context
      const embeddings = await embedTexts(allChunks.map((c) => `File: ${c.filePath}\n\n${c.text}`));
      // Batch insert into Postgres
      await insertChunksBatch(db, repositoryId, allChunks, embeddings, DB_BATCH_SIZE);
    }

    await db.query(`UPDATE repositories SET indexed_at = now() WHERE id = $1`, [repositoryId]);

    return NextResponse.json({
      repositoryId,
      filesIndexed,
      chunksIndexed: allChunks.length,
      skipped: {
        unsupportedType: skippedUnsupported.length,
        unsupportedSample: skippedUnsupported.slice(0, 30),
        overFileCap: skippedOverFileCap.length,
        overFileCapSample: skippedOverFileCap.slice(0, 30),
        hitChunkCap,
      },
    });
  } catch (err) {
    console.error("Indexing failed:", err);
    return NextResponse.json({ error: err.message || "Indexing failed" }, { status: 500 });
  }
}
