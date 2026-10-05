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
  const { rows } = await db.query(
    `SELECT m.id, m.message, m.created_at, u.github_login
     FROM repo_messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.repository_id = $1
     ORDER BY m.created_at ASC`,
    [repositoryId]
  );

  return NextResponse.json({
    messages: rows.map((r) => ({
      id: r.id,
      message: r.message,
      createdAt: r.created_at,
      author: r.github_login,
    })),
  });
}

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { repositoryId, message } = await request.json();
  if (!repositoryId || !message?.trim()) {
    return NextResponse.json({ error: "repositoryId and message are required" }, { status: 400 });
  }

  const db = getDb();
  await db.query(
    `INSERT INTO repo_messages (repository_id, user_id, message) VALUES ($1, $2, $3)`,
    [repositoryId, user.id, message.trim()]
  );

  return NextResponse.json({ ok: true });
}
