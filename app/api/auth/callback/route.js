// Step 2 of login: GitHub redirects back here with a temporary "code".
// We exchange it for a real access token, then look up (or create) the user.
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export async function GET(request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const code = new URL(request.url).searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${appUrl}?error=missing_code`);
  }

  // Exchange the temporary code for a real access token.
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  const { access_token } = tokenData;

  if (!access_token) {
    console.error("GitHub token exchange failed:", tokenData);
    return NextResponse.redirect(`${appUrl}?error=oauth_failed`);
  }

  // Fetch the GitHub profile that this token belongs to.
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userRes.ok) {
    return NextResponse.redirect(`${appUrl}?error=github_user_fetch_failed`);
  }
  const githubUser = await userRes.json();

  // Create the user if new, or update their token if they've logged in before.
  let userId;
  try {
    const db = getDb();
    const { rows } = await db.query(
      `INSERT INTO users (github_id, github_login, access_token)
       VALUES ($1, $2, $3)
       ON CONFLICT (github_id) DO UPDATE SET access_token = $3
       RETURNING id`,
      [githubUser.id, githubUser.login, access_token]
    );
    userId = rows[0].id;
  } catch (err) {
    console.error("Database error during login:", err);
    return NextResponse.redirect(`${appUrl}?error=db_error`);
  }

  // Set a simple session cookie (just the user id). This is fine for a course
  // project; use a signed/encrypted session (e.g. iron-session) in production.
  const response = NextResponse.redirect(`${appUrl}/dashboard`);
  response.cookies.set("session_user_id", String(userId), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
  return response;
}
