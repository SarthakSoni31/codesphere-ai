// Applies db/schema.sql to the database at process.env.DATABASE_URL.
// Usage: npm run db:migrate   (reads .env.local automatically via Next.js env loading
//         is NOT active here, so make sure DATABASE_URL is exported in your shell,
//         e.g. `export $(grep -v '^#' .env.local | xargs) && npm run db:migrate`)

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Export it before running this script.");
    process.exit(1);
  }

  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const client = new Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log("Applying schema.sql ...");
  await client.query(sql);
  console.log(
    "Done. Tables ready: users, repositories, chunks, issue_summaries, repo_messages, assignments."
  );
  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
