import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../../../lib/db";
import { findRelevantChunks } from "../../../../../lib/retrieval";

export async function POST(request, { params }) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const repositoryId = parseInt(params.id, 10);
  if (isNaN(repositoryId)) {
    return NextResponse.json({ error: "Invalid repository ID" }, { status: 400 });
  }

  const db = getDb();
  const { rows: repoRows } = await db.query(
    `SELECT id, owner, name, default_branch FROM repositories WHERE id = $1`,
    [repositoryId]
  );
  if (repoRows.length === 0) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }
  const repo = repoRows[0];

  // Sample up to 20 distinct code chunks across diverse files, prioritizing source code
  const { rows: sampleChunks } = await db.query(
    `WITH distinct_files AS (
       SELECT DISTINCT ON (file_path) id, file_path, start_line, end_line, content
       FROM chunks
       WHERE repository_id = $1 AND content IS NOT NULL AND length(content) > 30
       ORDER BY file_path, id ASC
     )
     SELECT * FROM distinct_files
     ORDER BY 
       (CASE 
          WHEN file_path ~ '\\.(tsx?|jsx?|py|go|java|rb|rs|c|cpp|php|vue|svelte)$' THEN 0 
          WHEN file_path LIKE 'docs/%' OR file_path LIKE '%.md' THEN 2 
          WHEN file_path LIKE '.github/%' THEN 3
          ELSE 1 
        END),
       file_path ASC
     LIMIT 20`,
    [repositoryId]
  );

  if (sampleChunks.length === 0) {
    return NextResponse.json(
      { error: "No indexed chunks found. Please index this repository first." },
      { status: 400 }
    );
  }

  const probeResults = [];
  let passedCount = 0;

  for (const chunk of sampleChunks) {
    const filename = chunk.file_path.split("/").pop();

    // Look for exported identifier, class, or function name in the chunk
    const symbolMatch = chunk.content.match(
      /(?:export\s+(?:default\s+)?(?:function|class|const|let|interface|type)\s+|function\s+|class\s+|const\s+)([a-zA-Z0-9_$]+)/
    );
    const symbol = symbolMatch ? symbolMatch[1] : filename.replace(/\.[^/.]+$/, "");

    const probeQuestion = `Where is ${symbol} defined in ${filename}?`;

    try {
      const retrieved = await findRelevantChunks(db, {
        repositoryId,
        query: probeQuestion,
        contextText: `${chunk.file_path} ${symbol}`,
        limit: 4,
        isCodeQuestion: true,
      });

      const matched = retrieved.some(
        (r) =>
          r.filePath === chunk.file_path ||
          r.filePath.endsWith(filename) ||
          (r.content && r.content.includes(symbol))
      );
      const sources = matched ? [`${chunk.file_path}:${chunk.start_line}-${chunk.end_line}`] : [];

      if (matched) {
        passedCount++;
      }

      // Record probe query in qa_history so it feeds into live grounding metrics
      await db.query(
        `INSERT INTO qa_history (repository_id, user_id, question, answer, sources)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          repositoryId,
          user.id,
          probeQuestion,
          matched
            ? `[Grounding Probe] Verified: \`${symbol}\` is grounded in \`${chunk.file_path}\` (lines ${chunk.start_line}-${chunk.end_line}).`
            : `[Grounding Probe] Insufficient context: Could not ground \`${chunk.file_path}\` in top retrieval results.`,
          sources,
        ]
      );

      probeResults.push({
        filePath: chunk.file_path,
        symbol,
        question: probeQuestion,
        passed: matched,
        sources,
      });
    } catch (err) {
      probeResults.push({
        filePath: chunk.file_path,
        symbol,
        question: probeQuestion,
        passed: false,
        error: err.message,
      });
    }
  }

  // Fetch updated repository-level metrics from qa_history
  const { rows: statsRows } = await db.query(
    `SELECT
       COUNT(id)::integer AS total_queries,
       COUNT(id) FILTER (WHERE sources IS NOT NULL AND array_length(sources, 1) > 0)::integer AS grounded_queries
     FROM qa_history
     WHERE repository_id = $1`,
    [repositoryId]
  );

  const total = statsRows[0]?.total_queries || 0;
  const grounded = statsRows[0]?.grounded_queries || 0;
  const groundingRate = total > 0 ? Number(((grounded / total) * 100).toFixed(1)) : 0;
  const targetMet = groundingRate >= 85.0;

  return NextResponse.json({
    ok: true,
    totalProbes: sampleChunks.length,
    passedProbes: passedCount,
    probeGroundingRate: Number(((passedCount / sampleChunks.length) * 100).toFixed(1)),
    overallGroundingRate: groundingRate,
    totalQueries: total,
    groundedQueries: grounded,
    targetMet,
    results: probeResults,
  });
}
