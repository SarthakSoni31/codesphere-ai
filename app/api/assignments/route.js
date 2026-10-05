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

  // Every indexed file for this repo, left-joined with any assignment on it,
  // so unassigned files show up too (with assignee = null).
  const { rows } = await db.query(
    `SELECT DISTINCT c.file_path,
       a.id AS assignment_id,
       a.note,
       a.deadline,
       a.updated_at,
       assignee.github_login AS assigned_to,
       assigner.github_login AS assigned_by
     FROM chunks c
     LEFT JOIN assignments a ON a.repository_id = c.repository_id AND a.file_path = c.file_path
     LEFT JOIN users assignee ON assignee.id = a.assigned_to
     LEFT JOIN users assigner ON assigner.id = a.assigned_by
     WHERE c.repository_id = $1
     ORDER BY c.file_path ASC`,
    [repositoryId]
  );

  return NextResponse.json({
    files: rows.map((r) => ({
      filePath: r.file_path,
      assignedTo: r.assigned_to,
      assignedBy: r.assigned_by,
      note: r.note,
      deadline: r.deadline,
      updatedAt: r.updated_at,
    })),
  });
}

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { repositoryId, filePath, assignedTo, note, deadline } = await request.json();
  if (!repositoryId || !filePath || !assignedTo) {
    return NextResponse.json(
      { error: "repositoryId, filePath, and assignedTo are required" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Only the person who connected/indexed this repo can assign tasks on it.
  // Everyone else can view assignments (via GET) but not create or change them.
  const { rows: repoRows } = await db.query(`SELECT user_id FROM repositories WHERE id = $1`, [
    repositoryId,
  ]);
  if (repoRows.length === 0) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }
  if (repoRows[0].user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the repo admin (whoever connected it) can assign tasks." },
      { status: 403 }
    );
  }

  await db.query(
    `INSERT INTO assignments (repository_id, file_path, assigned_to, assigned_by, note, deadline)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (repository_id, file_path)
     DO UPDATE SET assigned_to = $3, assigned_by = $4, note = $5, deadline = $6, updated_at = now()`,
    [repositoryId, filePath, assignedTo, user.id, note || null, deadline || null]
  );

  return NextResponse.json({ ok: true });
}
