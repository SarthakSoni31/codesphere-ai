// Step 1 of login: send the user to GitHub to approve access, requesting
// just enough scope to read repos (public + private) and the user's profile.
import { NextResponse } from "next/server";

export async function GET() {
  if (!process.env.GITHUB_CLIENT_ID) {
    return NextResponse.json({ error: "GITHUB_CLIENT_ID is not configured" }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    scope: "read:user repo",
  });

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}
