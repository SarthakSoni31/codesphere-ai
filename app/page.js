import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function Home() {
  const isSignedIn = Boolean(cookies().get("session_user_id"));
  if (isSignedIn) redirect("/dashboard");

  return (
    <main style={{ maxWidth: 560, margin: "6rem auto", padding: "0 1.5rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "2rem" }}>CodeSphere AI</h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem", fontSize: "0.95rem" }}>
        A shared workspace for your team: connect a GitHub repository, ask questions about the
        codebase grounded in the real source, see who has access, and auto-triage new issues —
        all in one place.
      </p>
      <a href="/api/auth/github" className="btn btn-primary" style={{ textDecoration: "none", padding: "0.7rem 1.5rem" }}>
        Sign in with GitHub
      </a>
    </main>
  );
}
