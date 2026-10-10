import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../lib/db";
import { findRelevantChunks } from "../../../lib/retrieval";
import { generateGroundedAnswer } from "../../../lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOP_K = 6;

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { repositoryId, question } = await request.json();
  if (!repositoryId || !question) {
    return NextResponse.json({ error: "repositoryId and question are required" }, { status: 400 });
  }

  const db = getDb();

  // Any signed-in teammate can query any repo the team has indexed — this is
  // a shared workspace, not a per-user private one. We still require login
  // (checked above) so it's not open to the public internet, and we still
  // confirm the repo exists so a bad/old id gives a clean error.
  const { rows: repoRows } = await db.query(
    `SELECT id, owner, name, default_branch FROM repositories WHERE id = $1`,
    [repositoryId]
  );
  if (repoRows.length === 0) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  const repo = repoRows[0];

  // Fetch repository stats and sample indexed paths to give Copilot full awareness of the codebase
  let repoContext = null;
  try {
    const { rows: statsRows } = await db.query(
      `SELECT COUNT(DISTINCT file_path) as file_count, COUNT(*) as chunk_count FROM chunks WHERE repository_id = $1`,
      [repositoryId]
    );
    const { rows: pathRows } = await db.query(
      `SELECT DISTINCT file_path FROM chunks WHERE repository_id = $1 ORDER BY file_path ASC LIMIT 40`,
      [repositoryId]
    );
    repoContext = {
      owner: repo.owner,
      name: repo.name,
      totalChunks: Number(statsRows[0]?.chunk_count) || 0,
      totalFiles: Number(statsRows[0]?.file_count) || 0,
      samplePaths: pathRows.map((r) => r.file_path),
    };
  } catch (err) {
    console.warn("Could not fetch repo stats for chat:", err.message);
  }

  try {
    const chunks = await findRelevantChunks(db, {
      repositoryId,
      query: question,
      contextText: question,
      limit: TOP_K,
      isCodeQuestion: true,
      githubContext: {
        token: user.access_token,
        owner: repo.owner,
        repo: repo.name,
        defaultBranch: repo.default_branch || "main",
      },
    });

    const { answer, sources } = await generateGroundedAnswer(question, chunks, repoContext);

    // Persist so this survives a refresh / repo switch. Best-effort and
    // isolated in its own try/catch — a DB hiccup here shouldn't take down
    // an otherwise-successful answer the user is waiting on.
    try {
      await db.query(
        `INSERT INTO qa_history (repository_id, user_id, question, answer, sources)
         VALUES ($1, $2, $3, $4, $5)`,
        [repositoryId, user.id, question, answer, sources]
      );
    } catch (err) {
      console.error("Failed to save chat history (answer still returned):", err);
    }

    return NextResponse.json({ answer, sources });
  } catch (err) {
    console.error("Chat failed:", err);
    return NextResponse.json({ error: err.message || "Chat failed" }, { status: 500 });
  }
}
