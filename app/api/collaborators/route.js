import { NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/db";
import { getCollaborators } from "../../../lib/github";

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
    const raw = await getCollaborators(user.access_token, owner, repo);
    const collaborators = raw.map((c) => ({
      login: c.login,
      avatarUrl: c.avatar_url,
      role: c.role_name || (c.permissions?.admin ? "admin" : c.permissions?.push ? "write" : "read"),
    }));
    return NextResponse.json({ collaborators });
  } catch (err) {
    // GitHub 403s this for anyone without at least push access to the repo —
    // that's normal for a public repo you only have read access to, not a bug.
    console.error("Collaborators fetch failed:", err);
    return NextResponse.json(
      {
        error:
          "Couldn't load the team list for this repo — you may need push access to it on GitHub to see who else has access.",
      },
      { status: 403 }
    );
  }
}
