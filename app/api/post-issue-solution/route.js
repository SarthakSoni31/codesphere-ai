import { NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/db";
import { postIssueComment } from "../../../lib/github";

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { owner, repo, issueNumber, comment } = await request.json();
  if (!owner || !repo || !issueNumber || !comment) {
    return NextResponse.json(
      { error: "owner, repo, issueNumber, and comment are required" },
      { status: 400 }
    );
  }

  try {
    const commentBody = `${comment.trim()}\n\n---\n_Proposed fix formulated via CodeSphere AI by @${user.github_login}_`;
    const result = await postIssueComment(
      user.access_token,
      owner,
      repo,
      issueNumber,
      commentBody
    );

    return NextResponse.json({
      ok: true,
      url: result.html_url,
      id: result.id,
    });
  } catch (err) {
    console.error("Post issue solution failed:", err);
    return NextResponse.json(
      {
        error:
          err.message ||
          "Could not post comment to GitHub. Ensure your GitHub account has comment access on this repository.",
      },
      { status: 500 }
    );
  }
}
