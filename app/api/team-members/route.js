import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../lib/db";

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const db = getDb();
  const { rows } = await db.query(
    `SELECT id, github_login FROM users ORDER BY github_login ASC`
  );
  return NextResponse.json({ members: rows.map((r) => ({ id: r.id, login: r.github_login })) });
}
