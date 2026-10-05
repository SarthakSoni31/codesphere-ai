import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../lib/db";

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get("repositoryId");
  if (!repositoryId) {
    return NextResponse.json({ error: "repositoryId query param is required" }, { status: 400 });
  }

  const db = getDb();
  // Private by design: only this user's own history for this repo, never
  // teammates' questions — that's what the Discussion tab is for.
  const { rows } = await db.query(
    `SELECT question, answer, sources, created_at
     FROM qa_history
     WHERE repository_id = $1 AND user_id = $2
     ORDER BY created_at ASC`,
    [repositoryId, user.id]
  );

  return NextResponse.json({
    history: rows.map((r) => ({
      question: r.question,
      answer: r.answer,
      sources: r.sources || [],
      createdAt: r.created_at,
    })),
  });
}

// Clears the current user's own saved Q&A for a repo — never touches
// teammates' history, since chat history is private per person.
export async function DELETE(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get("repositoryId");
  if (!repositoryId) {
    return NextResponse.json({ error: "repositoryId query param is required" }, { status: 400 });
  }

  const db = getDb();
  await db.query(`DELETE FROM qa_history WHERE repository_id = $1 AND user_id = $2`, [
    repositoryId,
    user.id,
  ]);

  return NextResponse.json({ ok: true });
}
