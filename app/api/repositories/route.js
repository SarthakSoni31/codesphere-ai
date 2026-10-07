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
       r.default_branch,
       r.indexed_at,
       r.user_id AS indexed_by_user_id,
       u.github_login AS indexed_by,
       COALESCE(c_stats.chunk_count, 0)::integer AS chunk_count,
       COALESCE(q_stats.total_queries, 0)::integer AS total_queries,
       COALESCE(q_stats.grounded_queries, 0)::integer AS grounded_queries
     FROM repositories r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN (
       SELECT repository_id, COUNT(id) AS chunk_count
       FROM chunks
       GROUP BY repository_id
     ) c_stats ON c_stats.repository_id = r.id
     LEFT JOIN (
       SELECT 
         repository_id,
         COUNT(id) AS total_queries,
         COUNT(id) FILTER (WHERE sources IS NOT NULL AND array_length(sources, 1) > 0) AS grounded_queries
       FROM qa_history
       GROUP BY repository_id
     ) q_stats ON q_stats.repository_id = r.id
     ORDER BY r.indexed_at DESC NULLS LAST`
  );

  return NextResponse.json({
    repositories: rows.map((row) => {
      const total = Number(row.total_queries) || 0;
      const grounded = Number(row.grounded_queries) || 0;
      const groundingRate = total > 0 ? Number(((grounded / total) * 100).toFixed(1)) : null;
      const targetMet = groundingRate !== null && groundingRate >= 85.0;
      const groundingStatus = total === 0 ? "unverified" : targetMet ? "healthy" : "failing";

      return {
        id: row.id,
        owner: row.owner,
        name: row.name,
        defaultBranch: row.default_branch || "main",
        indexedAt: row.indexed_at,
        indexedBy: row.indexed_by,
        indexedByUserId: row.indexed_by_user_id,
        chunkCount: Number(row.chunk_count),
        totalQueries: total,
        groundedQueries: grounded,
        groundingRate,
        targetMet,
        groundingStatus,
        groundingTarget: 85.0,
      };
    }),
  });
}
