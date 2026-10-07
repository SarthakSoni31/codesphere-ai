/**
 * Helper to record and fetch delivered solutions and pull requests.
 */

let tableEnsured = false;

export async function ensureDeliveredSolutionsTable(db) {
  if (tableEnsured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS delivered_solutions (
        id              SERIAL PRIMARY KEY,
        repository_id   INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        issue_number    INTEGER NOT NULL,
        delivery_type   TEXT NOT NULL,
        pr_number       INTEGER,
        pr_url          TEXT,
        comment_url     TEXT,
        branch          TEXT,
        solution_text   TEXT,
        user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (repository_id, issue_number, delivery_type)
      );
      CREATE INDEX IF NOT EXISTS delivered_solutions_repo_idx ON delivered_solutions (repository_id);
    `);
    tableEnsured = true;
  } catch (err) {
    console.warn("ensureDeliveredSolutionsTable warning:", err.message);
  }
}

export async function recordDeliveredSolution(db, {
  owner,
  repo,
  issueNumber,
  deliveryType, // 'comment' | 'pr'
  prNumber = null,
  prUrl = null,
  commentUrl = null,
  branch = null,
  solutionText = null,
  userId = null,
}) {
  await ensureDeliveredSolutionsTable(db);

  // 1. Resolve repository_id
  let repoId = null;
  const { rows: repoRows } = await db.query(
    `SELECT id FROM repositories WHERE owner = $1 AND name = $2`,
    [owner, repo]
  );
  if (repoRows.length > 0) {
    repoId = repoRows[0].id;
  } else if (userId) {
    // Insert stub repo record if not present
    const { rows: newRepo } = await db.query(
      `INSERT INTO repositories (owner, name, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (owner, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [owner, repo, userId]
    );
    repoId = newRepo[0]?.id;
  }

  if (!repoId) return null;

  // 2. Upsert delivered solution
  const { rows } = await db.query(
    `INSERT INTO delivered_solutions (
       repository_id, issue_number, delivery_type, pr_number, pr_url, comment_url, branch, solution_text, user_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (repository_id, issue_number, delivery_type)
     DO UPDATE SET
       pr_number = EXCLUDED.pr_number,
       pr_url = EXCLUDED.pr_url,
       comment_url = EXCLUDED.comment_url,
       branch = EXCLUDED.branch,
       solution_text = EXCLUDED.solution_text,
       user_id = EXCLUDED.user_id,
       created_at = NOW()
     RETURNING id`,
    [repoId, issueNumber, deliveryType, prNumber, prUrl, commentUrl, branch, solutionText, userId]
  );

  return rows[0] || null;
}

export async function getDeliveredSolutions(db, owner, repo) {
  await ensureDeliveredSolutionsTable(db);
  try {
    const { rows } = await db.query(
      `SELECT ds.issue_number, ds.delivery_type, ds.pr_number, ds.pr_url, ds.comment_url,
              ds.branch, ds.created_at, u.github_login
       FROM delivered_solutions ds
       JOIN repositories r ON r.id = ds.repository_id
       LEFT JOIN users u ON u.id = ds.user_id
       WHERE r.owner = $1 AND r.name = $2`,
      [owner, repo]
    );

    const map = {};
    for (const r of rows) {
      if (!map[r.issue_number]) {
        map[r.issue_number] = { comment: null, pr: null };
      }
      if (r.delivery_type === "comment") {
        map[r.issue_number].comment = {
          url: r.comment_url,
          createdAt: r.created_at,
          user: r.github_login,
        };
      } else if (r.delivery_type === "pr") {
        map[r.issue_number].pr = {
          number: r.pr_number,
          url: r.pr_url,
          branch: r.branch,
          createdAt: r.created_at,
          user: r.github_login,
        };
      }
    }
    return map;
  } catch (err) {
    console.warn("getDeliveredSolutions error:", err.message);
    return {};
  }
}
