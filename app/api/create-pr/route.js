import { NextResponse } from "next/server";
import { getDb, getSessionUser } from "../../../lib/db";
import { createBranch, createOrUpdateFile, createPullRequest } from "../../../lib/github";

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { owner, repo, issueNumber, title, body, filePath, fileContent } = await request.json();
  if (!owner || !repo || !issueNumber) {
    return NextResponse.json({ error: "owner, repo, and issueNumber are required" }, { status: 400 });
  }

  const db = getDb();
  const { rows: repoRows } = await db.query(
    `SELECT default_branch FROM repositories WHERE owner = $1 AND name = $2`,
    [owner, repo]
  );
  const defaultBranch = repoRows[0]?.default_branch || "main";

  const branchName = `codesphere/fix-issue-${issueNumber}-${Date.now().toString().slice(-4)}`;

  try {
    // 1. Create a dedicated branch from defaultBranch
    await createBranch(user.access_token, owner, repo, branchName, defaultBranch);

    // 2. If a specific file modification was supplied, commit it to the new branch
    if (filePath && fileContent) {
      await createOrUpdateFile(
        user.access_token,
        owner,
        repo,
        filePath,
        fileContent,
        `fix: apply resolution for issue #${issueNumber}`,
        branchName
      );
    }

    // 3. Open the Pull Request on GitHub
    const prTitle = title || `fix: address issue #${issueNumber}`;
    const prBody = `${body || "Proposed fix generated via CodeSphere AI."}\n\nFixes #${issueNumber}\n\n---\n_Formulated and opened via CodeSphere AI by @${user.github_login}_`;

    const pr = await createPullRequest(
      user.access_token,
      owner,
      repo,
      prTitle,
      prBody,
      branchName,
      defaultBranch
    );

    return NextResponse.json({
      ok: true,
      url: pr.html_url,
      number: pr.number,
      branch: branchName,
    });
  } catch (err) {
    console.error("Create PR failed:", err);
    let message = err.message || "Failed to create Pull Request";
    if (message.includes("403") || message.includes("Permission denied")) {
      message = "You do not have direct push permissions on this repository. To contribute, fork the repository or post the solution as an issue comment instead.";
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
