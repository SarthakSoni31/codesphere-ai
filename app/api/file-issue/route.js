import { NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/db";
import { createIssue } from "../../../lib/github";

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { owner, repo, title, body } = await request.json();
  if (!owner || !repo || !title) {
    return NextResponse.json({ error: "owner, repo, and title are required" }, { status: 400 });
  }

  try {
    // Filed under the CURRENT user's own GitHub account (their token), not
    // whoever connected the repo — this is a deliberate, attributed action
    // the person clicked a button for, not something the bot did silently.
    const issue = await createIssue(
      user.access_token,
      owner,
      repo,
      title,
      `${body}\n\n---\n_Flagged by CodeSphere AI's automatic bug scan and filed by @${user.github_login}._`,
      ["bug"]
    );
    return NextResponse.json({ url: issue.html_url, number: issue.number });
  } catch (err) {
    console.error("File issue failed:", err);
    // Most common cause: the user only has read access to this repo.
    return NextResponse.json(
      { error: "Couldn't create the issue — you may need write access to this repo on GitHub." },
      { status: 403 }
    );
  }
}
