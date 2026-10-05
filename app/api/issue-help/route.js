import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../lib/db";
import { embedText, toVectorLiteral } from "../../../lib/embeddings";
import { generateGroundedAnswer } from "../../../lib/llm";

const TOP_K = 5;

// Same idea as the webhook bot's "Where to look" section, but callable
// on-demand from the website — covers issues opened before the webhook was
// set up, or for anyone who'd rather not wire up ngrok/webhooks at all.
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { repositoryId, title, issueBody } = await request.json();
  if (!repositoryId || !title) {
    return NextResponse.json({ error: "repositoryId and title are required" }, { status: 400 });
  }

  const db = getDb();
  const { rows: repoRows } = await db.query(`SELECT id FROM repositories WHERE id = $1`, [repositoryId]);
  if (repoRows.length === 0) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  try {
    const question = `A user reported this bug:\n"${title}"\n${issueBody || ""}\n\nWhich files in the codebase are most likely responsible, and what should someone check first?`;
    const questionEmbedding = await embedText(question);

    const { rows: chunkRows } = await db.query(
      `SELECT file_path, start_line, end_line, content
       FROM chunks
       WHERE repository_id = $1
       ORDER BY embedding <=> $2
       LIMIT $3`,
      [repositoryId, toVectorLiteral(questionEmbedding), TOP_K]
    );

    const chunks = chunkRows.map((r) => ({
      filePath: r.file_path,
      startLine: r.start_line,
      endLine: r.end_line,
      content: r.content,
    }));

    const { answer, sources } = await generateGroundedAnswer(question, chunks);
    return NextResponse.json({ answer, sources });
  } catch (err) {
    console.error("Issue help failed:", err);
    return NextResponse.json({ error: err.message || "Failed to get AI help" }, { status: 500 });
  }
}
