import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../lib/db";
import { getRepo, getRepoTree, getFileContent, isIndexableFile } from "../../../lib/github";
import { chunkFile } from "../../../lib/chunk";
import { embedTexts, toVectorLiteral } from "../../../lib/embeddings";

// Caps keep the demo fast and cheap; raise these once you've validated the
// pipeline against a real repo (see proposal section 6.1 - grounding rate).
// Caps keep indexing time bounded. Now that embeddings run locally (no API
// cost or rate limit), these are set higher than they used to be — the only
// real constraint is indexing time (roughly linear in chunk count). Raise
// further if you have a big repo and don't mind a longer wait.
const MAX_FILES = 400;
const MAX_CHUNKS = 2000;

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
    const filesToIndex = eligible.slice(0, MAX_FILES);

    // Track what got left out and why, so indexing isn't a silent black box —
    // shown back to the user after indexing finishes.
    const skippedUnsupported = allBlobEntries
      .filter((entry) => !isIndexableFile(entry.path, entry.size))
      .map((entry) => entry.path);
    const skippedOverFileCap = eligible.slice(MAX_FILES).map((entry) => entry.path);

    // Upsert the repository row up front so we have an id to attach chunks to.
    // Whoever (re-)indexes becomes the "connector" for this repo — their
    // GitHub token is what the auto-triage bot uses to post comments — so a
    // teammate re-indexing keeps that token fresh rather than relying on
    // whoever happened to connect it first.
    const { rows: repoRows } = await db.query(
      `INSERT INTO repositories (owner, name, user_id, default_branch)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (owner, name) DO UPDATE SET default_branch = $4, user_id = $3
       RETURNING id`,
      [owner, repo, user.id, branch]
    );
    const repositoryId = repoRows[0].id;

    // Build every chunk across every file before embedding, so we can batch
    // the embedding calls instead of doing one round-trip per file.
    const allChunks = [];
    let filesIndexed = 0;
    let hitChunkCap = false;
    for (const entry of filesToIndex) {
      const content = await getFileContent(user.access_token, owner, repo, entry.path, branch);
      if (!content) continue;
      filesIndexed++;
      for (const chunk of chunkFile(content)) {
        allChunks.push({ filePath: entry.path, ...chunk });
        if (allChunks.length >= MAX_CHUNKS) {
          hitChunkCap = true;
          break;
        }
      }
      if (hitChunkCap) break;
    }

    // Embed each chunk WITH its file path prepended as context, even though
    // we store and later display the original chunk text unchanged. Small,
    // similarly-shaped files (e.g. two Mongoose model definitions) can
    // otherwise embed to near-identical vectors, since the code itself gives
    // the embedding model little to tell them apart — the file path is
    // exactly the signal that's missing.
    const embeddings = await embedTexts(allChunks.map((c) => `File: ${c.filePath}\n\n${c.text}`));

    // Re-indexing replaces old chunks wholesale; incremental re-indexing
    // (see proposal 9.2) can diff against last_commit_sha instead.
    await db.query(`DELETE FROM chunks WHERE repository_id = $1`, [repositoryId]);
    for (let i = 0; i < allChunks.length; i++) {
      const c = allChunks[i];
      await db.query(
        `INSERT INTO chunks (repository_id, file_path, start_line, end_line, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [repositoryId, c.filePath, c.startLine, c.endLine, c.text, toVectorLiteral(embeddings[i])]
      );
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
