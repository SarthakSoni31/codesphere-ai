import { embedText, toVectorLiteral } from "./embeddings";

/**
 * Extracts potential file paths, filenames, and component/service names from a text prompt.
 * Examples:
 *   "webiu-server/src/contributor/contributor.service.spec.ts: Duplicate afterAll" ->
 *     ["%webiu-server/src/contributor/contributor.service.spec.ts%", "%contributor.service.spec.ts%"]
 *   "wrap raw error re-throw in DashboardService" ->
 *     ["%DashboardService%", "%dashboard.service%", "%dashboard-service%"]
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
 * Hybrid retrieval: Combines exact path/symbol pattern matching with semantic vector search.
 * When answering code questions or bug issues, applies a small penalty to non-code files
 * (.github/ templates, docs/ markdown) so template files never crowd out real code chunks.
 */
export async function findRelevantChunks(
  db,
  { repositoryId, query, contextText = "", limit = 6, isCodeQuestion = true }
) {
  const patterns = extractCandidateFilePatterns(`${query} ${contextText}`);
  const combined = [];
  const seenKeys = new Set();

  function addChunk(c) {
    const key = `${c.file_path}:${c.start_line}-${c.end_line}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
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

  return combined;
}
