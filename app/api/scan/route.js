import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../lib/db";
import { generateBugScan } from "../../../lib/llm";

// Depth over breadth: reviewing the FULL content of fewer files finds real
// logical bugs far better than a single truncated chunk from many files —
// a bug in the middle of a 200-line route handler is invisible if the scan
// only ever sees the first 40 lines. MAX_FILES caps how many whole files go
// into one scan (keeps the prompt a reasonable size); MAX_CHUNKS_PER_FILE
// caps how much of any single very large file gets included.
const MAX_FILES = 8;
const MAX_CHUNKS_PER_FILE = 6;

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { repositoryId } = await request.json();
  if (!repositoryId) {
    return NextResponse.json({ error: "repositoryId is required" }, { status: 400 });
  }

  const db = getDb();
  const { rows: repoRows } = await db.query(`SELECT id FROM repositories WHERE id = $1`, [repositoryId]);
  if (repoRows.length === 0) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  try {
    // Prioritize larger/more complex files first (more chunks = more logic
    // = more places for a real bug to hide), not just alphabetical order.
    const { rows: fileList } = await db.query(
      `SELECT file_path, COUNT(*) AS chunk_count
       FROM chunks
       WHERE repository_id = $1
       GROUP BY file_path
       ORDER BY chunk_count DESC, file_path ASC
       LIMIT $2`,
      [repositoryId, MAX_FILES]
    );

    if (fileList.length === 0) {
      return NextResponse.json({ findings: [], scannedFiles: 0 });
    }

    // Pull every chunk (up to the per-file cap) for each chosen file, in
    // order, so the model sees each file as a coherent whole rather than an
    // isolated fragment.
    const filesWithContent = [];
    for (const { file_path } of fileList) {
      const { rows: fileChunks } = await db.query(
        `SELECT start_line, end_line, content
         FROM chunks
         WHERE repository_id = $1 AND file_path = $2
         ORDER BY start_line ASC
         LIMIT $3`,
        [repositoryId, file_path, MAX_CHUNKS_PER_FILE]
      );
      filesWithContent.push({
        filePath: file_path,
        startLine: fileChunks[0]?.start_line ?? 1,
        endLine: fileChunks[fileChunks.length - 1]?.end_line ?? 1,
        content: fileChunks.map((c) => c.content).join("\n"),
      });
    }

    const findings = await generateBugScan(filesWithContent);
    return NextResponse.json({ findings, scannedFiles: filesWithContent.length });
  } catch (err) {
    console.error("Bug scan failed:", err);
    return NextResponse.json({ error: err.message || "Scan failed" }, { status: 500 });
  }
}
