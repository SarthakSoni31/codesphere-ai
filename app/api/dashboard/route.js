import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../lib/db";
import { getIssues, getRecentCommits, getCommitFiles } from "../../../lib/github";
import { getDeliveredSolutions } from "../../../lib/solutions";

const STALE_DAYS = 14;
const COMMIT_LOOKBACK_DAYS = 30;
const MAX_COMMITS_FOR_OWNERSHIP = 40; // keep this endpoint fast; it's a live pull, not indexed

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo query params are required" }, { status: 400 });
  }

  try {
    const rawIssues = await getIssues(user.access_token, owner, repo, "open");
    const issues = rawIssues.filter((i) => !i.pull_request); // exclude PRs from the issues endpoint

    const now = Date.now();
    const staleMs = STALE_DAYS * 24 * 60 * 60 * 1000;
    const staleIssues = issues
      .filter((i) => now - new Date(i.updated_at).getTime() > staleMs)
      .map((i) => ({ number: i.number, title: i.title, updatedAt: i.updated_at, body: i.body || "" }))
      .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));

    const allOpenIssues = issues
      .map((i) => ({ number: i.number, title: i.title, updatedAt: i.updated_at, body: i.body || "" }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Fetch delivered solutions (PRs and comments) recorded in CodeSphere
    const db = getDb();
    const deliveredSolutions = await getDeliveredSolutions(db, owner, repo);

    // Module ownership: look at recent commits, attribute each top-level
    // directory to whoever has touched it most in the lookback window.
    const since = new Date(now - COMMIT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const commits = (await getRecentCommits(user.access_token, owner, repo, since)).slice(
      0,
      MAX_COMMITS_FOR_OWNERSHIP
    );

    const moduleCounts = new Map(); // module -> Map(author -> count)
    for (const commit of commits) {
      const author = commit.author?.login || commit.commit?.author?.name || "unknown";
      const files = await getCommitFiles(user.access_token, owner, repo, commit.sha);
      const touchedModules = new Set(
        files.map((f) => (f.filename.includes("/") ? f.filename.split("/")[0] : "(root)"))
      );
      for (const mod of touchedModules) {
        if (!moduleCounts.has(mod)) moduleCounts.set(mod, new Map());
        const authorCounts = moduleCounts.get(mod);
        authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
      }
    }

    const moduleOwnership = [...moduleCounts.entries()]
      .map(([module, authorCounts]) => {
        const [owner_, commitCount] = [...authorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
        return { module, owner: owner_, commits: commitCount };
      })
      .sort((a, b) => b.commits - a.commits);

    return NextResponse.json({
      backlogHealth: { openCount: issues.length, staleCount: staleIssues.length },
      staleIssues,
      allOpenIssues,
      deliveredSolutions,
      moduleOwnership,
    });
  } catch (err) {
    console.error("Dashboard fetch failed:", err);
    return NextResponse.json({ error: err.message || "Dashboard fetch failed" }, { status: 500 });
  }
}
