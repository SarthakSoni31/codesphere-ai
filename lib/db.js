// Single shared Postgres connection pool.
// Next.js reuses this module across requests in the same server process, so we
// lazily create one Pool and hand back the same instance every time.
import { Pool } from "pg";

let pool;

export function getDb() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 10,
    });
  }
  return pool;
}

// Looks up the logged-in user from the session cookie set at login.
// Returns null if there's no session or the user no longer exists.
export async function getSessionUser(request) {
  const userId = request.cookies.get("session_user_id")?.value;
  if (!userId) return null;

  const db = getDb();
  const { rows } = await db.query(
    `SELECT id, github_id, github_login, access_token FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}
