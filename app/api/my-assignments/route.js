import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../lib/db";

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const db = getDb();
  const { rows } = await db.query(
    `SELECT
       a.id,
       a.file_path,
       a.note,
       a.deadline,
       a.read_at,
       a.updated_at,
       r.id AS repository_id,
       r.owner,
       r.name,
       assigner.github_login AS assigned_by
     FROM assignments a
     JOIN repositories r ON r.id = a.repository_id
     LEFT JOIN users assigner ON assigner.id = a.assigned_by
     WHERE a.assigned_to = $1
     ORDER BY a.deadline ASC NULLS LAST, a.updated_at DESC`,
    [user.id]
  );

  return NextResponse.json({
    assignments: rows.map((r) => ({
      id: r.id,
      filePath: r.file_path,
      note: r.note,
      deadline: r.deadline,
      isRead: Boolean(r.read_at),
      updatedAt: r.updated_at,
      repositoryId: r.repository_id,
      repositoryOwner: r.owner,
      repositoryName: r.name,
      assignedBy: r.assigned_by,
    })),
  });
}

// Marks one of the current user's own assignments as read (or unread).
// Body: { assignmentId, read: true|false }
export async function PATCH(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { assignmentId, read = true } = await request.json();
  if (!assignmentId) {
    return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
  }

  const db = getDb();
  // Only lets you mark YOUR OWN assignments read — the WHERE clause on
  // assigned_to enforces that, not just the id.
  await db.query(
    `UPDATE assignments SET read_at = $1 WHERE id = $2 AND assigned_to = $3`,
    [read ? new Date() : null, assignmentId, user.id]
  );

  return NextResponse.json({ ok: true });
}
