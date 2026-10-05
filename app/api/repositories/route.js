import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../lib/db";

// Team-wide by design: this returns every repo ANYONE on the team has
// indexed, not just the requesting user's own. Pairs with the chat route
// (which also allows any signed-in user to query any indexed repo) to make
// this a shared workspace rather than a per-person tool.
export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const db = getDb();
  const { rows } = await db.query(
    `SELECT
       r.id,
       r.owner,
       r.name,
       r.indexed_at,
       r.user_id AS indexed_by_user_id,
       u.github_login AS indexed_by,
       COUNT(c.id) AS chunk_count
     FROM repositories r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN chunks c ON c.repository_id = r.id
     GROUP BY r.id, u.github_login
     ORDER BY r.indexed_at DESC NULLS LAST`
  );

  return NextResponse.json({
    repositories: rows.map((row) => ({
      id: row.id,
      owner: row.owner,
      name: row.name,
      indexedAt: row.indexed_at,
      indexedBy: row.indexed_by,
      indexedByUserId: row.indexed_by_user_id,
      chunkCount: Number(row.chunk_count),
    })),
  });
}
