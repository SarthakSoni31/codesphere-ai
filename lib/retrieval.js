import { embedText, embedTexts, toVectorLiteral } from "./embeddings.js";
import { chunkFile } from "./chunk.js";
import { getFileContent, searchCode } from "./github.js";

/**
 * Extracts potential file paths, filenames, and component/service names from a text prompt.
 */
export function extractCandidateFilePatterns(text) {
  if (!text) return [];
  const patterns = new Set();

  // 1. Relative file paths (e.g., path/to/file.ext or dir/file.ts)
  const pathMatches = text.match(/(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+/g);
  if (pathMatches) {
    for (const p of pathMatches) {
      const clean = p.replace(/^[`'"]+|[`'"]+$/g, "").trim();
      if (clean) {
        patterns.add(`%${clean}%`);
        const basename = clean.split("/").pop();
        if (basename) patterns.add(`%${basename}%`);
      }
    }
  }

  // 2. Standalone filenames with code/source extensions
  const fileMatches = text.match(
    /\b[a-zA-Z0-9_.-]+\.(?:[tj]sx?|mjs|cjs|py|go|java|rb|rs|c|cpp|h|hpp|cs|php|kt|swift|scala|vue|svelte|html|css|json|yaml|yml|sql)\b/g
  );
  if (fileMatches) {
    for (const f of fileMatches) {
      const clean = f.replace(/^[`'"]+|[`'"]+$/g, "").trim();
      if (clean) patterns.add(`%${clean}%`);
    }
  }

  // 3. PascalCase Service, Controller, Module, or Component symbols
  const symbolMatches = text.match(
    /\b[A-Z][a-zA-Z0-9]{2,}(?:Service|Controller|Module|Model|Component|Route|Handler|Provider)\b/g
  );
  if (symbolMatches) {
    for (const s of symbolMatches) {
      patterns.add(`%${s}%`);
      const kebab = s.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
      const dot = s.replace(/([a-z])([A-Z])/g, "$1.$2").toLowerCase();
      patterns.add(`%${kebab}%`);
      patterns.add(`%${dot}%`);
    }
  }

  return [...patterns];
}

/**
 * Extracts raw relative paths mentioned in the text (e.g., "src/foo/bar.ts")
 */
export function extractRawFilePaths(text) {
  if (!text) return [];
  const matches = text.match(/(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+/g) || [];
  return [...new Set(matches.map((p) => p.replace(/^[`'"]+|[`'"]+$/g, "").trim()).filter(Boolean))];
}

/**
 * On-demand helper: Downloads a file from GitHub, chunks it, embeds it,
 * and caches it into the Postgres chunks table on the fly.
 */
async function indexFileOnDemand(db, repositoryId, githubContext, filePath) {
  try {
    const { token, owner, repo, defaultBranch } = githubContext;
    const content = await getFileContent(token, owner, repo, filePath, defaultBranch || "main");
    if (!content) return [];

    const fileChunks = chunkFile(content);
    if (fileChunks.length === 0) return [];

    const embeddings = await embedTexts(fileChunks.map((c) => `File: ${filePath}\n\n${c.text}`));

    const insertedChunks = [];
    for (let i = 0; i < fileChunks.length; i++) {
      const c = fileChunks[i];
      const { rows } = await db.query(
        `INSERT INTO chunks (repository_id, file_path, start_line, end_line, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING file_path, start_line, end_line, content`,
        [repositoryId, filePath, c.startLine, c.endLine, c.text, toVectorLiteral(embeddings[i])]
      );
      if (rows[0]) insertedChunks.push(rows[0]);
    }

    console.log(`[JIT Indexer] Dynamically indexed unindexed file from GitHub: ${filePath} (${insertedChunks.length} chunks)`);
    return insertedChunks;
  } catch (err) {
    console.warn(`[JIT Indexer] On-demand indexing failed for ${filePath}:`, err.message);
    return [];
  }
}

/**
 * Hybrid retrieval: Combines exact path/symbol pattern matching with semantic vector search.
 * When answering code questions or bug issues, applies a small penalty to non-code files
 * (.github/ templates, docs/ markdown) so template files never crowd out real code chunks.
 *
 * Includes Just-In-Time (JIT) On-Demand Fetching: If an issue or query points to a file
 * outside the pre-indexed set, CodeSphere fetches the file from GitHub on the fly,
 * chunks & embeds it, caches it in Postgres, and supplies it to the LLM.
 */
export async function findRelevantChunks(
  db,
  { repositoryId, query, contextText = "", limit = 6, isCodeQuestion = true, githubContext = null }
) {
  const combinedText = `${query} ${contextText}`;
  const patterns = extractCandidateFilePatterns(combinedText);
  const rawPaths = extractRawFilePaths(combinedText);
  const combined = [];
  const seenKeys = new Set();
  const indexedPathsInResult = new Set();

  function addChunk(c) {
    const key = `${c.file_path}:${c.start_line}-${c.end_line}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      indexedPathsInResult.add(c.file_path);
      combined.push({
        filePath: c.file_path,
        startLine: c.start_line,
        endLine: c.end_line,
        content: c.content,
      });
    }
  }

  // Step 1: Query exact file patterns if any were mentioned
  if (patterns.length > 0) {
    try {
      const { rows: directRows } = await db.query(
        `SELECT file_path, start_line, end_line, content
         FROM chunks
         WHERE repository_id = $1 AND file_path ILIKE ANY($2::text[])
         ORDER BY start_line ASC
         LIMIT $3`,
        [repositoryId, patterns, limit]
      );
      for (const r of directRows) addChunk(r);
    } catch (err) {
      console.warn("Direct file pattern query failed, falling back to vector search:", err.message);
    }
  }

  // Step 1b: Just-In-Time (JIT) On-Demand Fetching for unindexed candidate paths
  if (githubContext && rawPaths.length > 0) {
    for (const rawPath of rawPaths) {
      // If none of the retrieved chunks match this rawPath, it might not be in DB yet
      const alreadyHasPath = [...indexedPathsInResult].some((p) => p.includes(rawPath) || rawPath.includes(p));
      if (!alreadyHasPath && combined.length < limit) {
        const newChunks = await indexFileOnDemand(db, repositoryId, githubContext, rawPath);
        for (const nc of newChunks) {
          if (combined.length >= limit) break;
          addChunk(nc);
        }
      }
    }
  }

  // Step 2: Semantic vector search for additional or unspecified chunks
  if (combined.length < limit) {
    const needed = limit - combined.length;
    const queryEmbedding = await embedText(query);
    const penaltyClause = isCodeQuestion
      ? " + (CASE WHEN file_path LIKE '.github/%' OR file_path LIKE 'docs/%' OR file_path LIKE '%.md' THEN 0.25 ELSE 0 END)"
      : "";

    const { rows: vectorRows } = await db.query(
      `SELECT file_path, start_line, end_line, content
       FROM chunks
       WHERE repository_id = $1
       ORDER BY (embedding <=> $2)${penaltyClause} ASC
       LIMIT $3`,
      [repositoryId, toVectorLiteral(queryEmbedding), needed + 5]
    );

    for (const r of vectorRows) {
      if (combined.length >= limit) break;
      addChunk(r);
    }
  }

  // Step 3: Coarse GitHub Code Search fallback if still 0 chunks found
  if (combined.length === 0 && githubContext) {
    try {
      // Extract keywords (words with > 3 characters, ignoring common stop words)
      const stopWords = new Set(["this", "that", "with", "from", "where", "what", "which", "user", "error", "issue", "file", "code"]);
      const keywords = query
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 3 && !stopWords.has(w.toLowerCase()))
        .slice(0, 3)
        .join(" ");

      if (keywords) {
        const foundPaths = await searchCode(githubContext.token, githubContext.owner, githubContext.repo, keywords);
        for (const fp of foundPaths.slice(0, 2)) {
          if (combined.length >= limit) break;
          const newChunks = await indexFileOnDemand(db, repositoryId, githubContext, fp);
          for (const nc of newChunks) {
            if (combined.length >= limit) break;
            addChunk(nc);
          }
        }
      }
    } catch (err) {
      console.warn("GitHub Code Search fallback failed:", err.message);
    }
  }

  return combined;
}
