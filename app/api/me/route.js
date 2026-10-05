import { NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/db";

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.json({ id: user.id, login: user.github_login });
}
