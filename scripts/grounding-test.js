// Grounding-rate test — satisfies the proposal's primary evaluation metric
// (Section 6.1): "percentage of AI-assistant answers that correctly cite an
// existing, relevant file in the indexed repository."
//
// This has to run against YOUR live app (real database, real Gemini calls),
// not in a sandbox — so it's a script you run yourself, not something
// pre-computed. See scripts/README.md for setup.
//
// Usage:
//   APP_URL=http://localhost:3000 SESSION_COOKIE=... OWNER=SarthakSoni31 REPO=naayak \
//     npm run test:grounding

const fs = require("fs");

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const SESSION_COOKIE = process.env.SESSION_COOKIE;
const OWNER = process.env.OWNER;
const REPO = process.env.REPO;
const DELAY_MS = 2000; // be gentle on Gemini's free-tier rate limit between questions

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!SESSION_COOKIE || !OWNER || !REPO) {
    console.error(
      "Missing required env vars. Usage:\n" +
        "  APP_URL=http://localhost:3000 SESSION_COOKIE=<value> OWNER=<owner> REPO=<repo> npm run test:grounding\n\n" +
        "See scripts/README.md for how to get SESSION_COOKIE."
    );
    process.exit(1);
  }

  const cookieHeader = `session_user_id=${SESSION_COOKIE}`;

  // Look up the repository's id by owner/name so you don't have to know the
  // raw database id.
  const reposRes = await fetch(`${APP_URL}/api/repositories`, {
    headers: { Cookie: cookieHeader },
  });
  if (!reposRes.ok) {
    console.error(`Failed to fetch repositories (${reposRes.status}). Is SESSION_COOKIE correct and is the app running?`);
    process.exit(1);
  }
  const { repositories } = await reposRes.json();
  const repo = repositories.find((r) => r.owner === OWNER && r.name === REPO);
  if (!repo) {
    console.error(
      `No indexed repository found for ${OWNER}/${REPO}. Indexed repos: ${
        repositories.map((r) => `${r.owner}/${r.name}`).join(", ") || "(none)"
      }`
    );
    process.exit(1);
  }

  const questions = JSON.parse(fs.readFileSync("scripts/grounding-questions.json", "utf8"));

  const results = [];
  console.log(`Running ${questions.length} questions against ${OWNER}/${REPO} (repositoryId=${repo.id})...\n`);

  for (const { question, expectedFile } of questions) {
    let res, data;
    // One retry on failure — we've seen the DB connection occasionally blip
    // and self-heal on the very next request, so don't count a single
    // transient hiccup as a real grounding failure.
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(`${APP_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ repositoryId: repo.id, question }),
      });
      data = await res.json();
      if (res.ok) break;
      if (attempt === 0) {
        console.log(`      (request failed, retrying once...)`);
        await sleep(DELAY_MS);
      }
    }
    const sources = data.sources || [];
    const grounded = sources.some((s) => s.startsWith(expectedFile));

    results.push({ question, expectedFile, sources, grounded, error: res.ok ? null : data.error });
    console.log(`${grounded ? "PASS" : "FAIL"}  ${question}`);
    if (!grounded) {
      console.log(`      expected: ${expectedFile}`);
      if (!res.ok) {
        console.log(`      REQUEST FAILED (${res.status}): ${data.error}`);
      } else {
        console.log(`      got sources: ${sources.join(", ") || "(none)"}`);
      }
    }

    await sleep(DELAY_MS);
  }

  const passCount = results.filter((r) => r.grounded).length;
  const rate = ((passCount / results.length) * 100).toFixed(1);

  console.log(`\nGrounding rate: ${passCount}/${results.length} (${rate}%)`);
  console.log(`Proposal target (Section 6.1): >= 85%`);

  // Write a markdown report for the project writeup.
  const lines = [
    `# Grounding-Rate Test Report`,
    ``,
    `Repository: \`${OWNER}/${REPO}\``,
    `Date: ${new Date().toISOString()}`,
    `Questions: ${results.length}`,
    `Grounding rate: **${passCount}/${results.length} (${rate}%)**`,
    `Proposal target: >= 85%`,
    ``,
    `| # | Question | Expected file | Sources returned | Result |`,
    `|---|---|---|---|---|`,
    ...results.map(
      (r, i) =>
        `| ${i + 1} | ${r.question} | \`${r.expectedFile}\` | ${
          r.sources.map((s) => `\`${s}\``).join(", ") || "—"
        } | ${r.grounded ? "Pass" : "Fail"} |`
    ),
  ];
  fs.writeFileSync("scripts/grounding-report.md", lines.join("\n"));
  console.log(`\nFull report written to scripts/grounding-report.md`);
}

main().catch((err) => {
  console.error("Test run failed:", err);
  process.exit(1);
});
