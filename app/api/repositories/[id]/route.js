import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../../lib/db";

export async function DELETE(request, { params }) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const repositoryId = params.id;
  const db = getDb();

  const { rows } = await db.query(`SELECT user_id FROM repositories WHERE id = $1`, [repositoryId]);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }
  if (rows[0].user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the repo admin (whoever connected it) can delete it." },
      { status: 403 }
    );
  }

  // Every other table references repositories with ON DELETE CASCADE, so
  // this one delete also removes the repo's chunks, discussion messages,
  // assignments, issue summaries, and chat history.
  await db.query(`DELETE FROM repositories WHERE id = $1`, [repositoryId]);

  return NextResponse.json({ ok: true });
}
