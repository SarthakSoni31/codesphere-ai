import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../lib/db";
import { findRelevantChunks } from "../../../lib/retrieval";
import { generateIssueSolution } from "../../../lib/llm";

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
    const question = `Generate concrete solution and code fix for issue: ${title}\n${issueBody || ""}`;
    const chunks = await findRelevantChunks(db, {
      repositoryId,
      query: question,
      contextText: `${title} ${issueBody || ""}`,
      limit: 6,
      isCodeQuestion: true,
    });

    const solution = await generateIssueSolution(title, issueBody, chunks);
    const sources = [...new Set(chunks.map((c) => `${c.filePath}:${c.startLine}-${c.endLine}`))];
    return NextResponse.json({ solution, sources });
  } catch (err) {
    console.error("Generate solution failed:", err);
    return NextResponse.json({ error: err.message || "Failed to generate solution" }, { status: 500 });
  }
}
