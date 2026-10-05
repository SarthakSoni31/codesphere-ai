"use client";

export default function SignOutButton() {
  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        background: "transparent",
        border: "1px solid var(--border)",
        color: "var(--muted)",
        padding: "0.4rem 0.8rem",
        borderRadius: 8,
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}
