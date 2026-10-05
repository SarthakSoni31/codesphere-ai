import { cookies } from "next/headers";
import SignOutButton from "./components/SignOutButton";
import NotificationBell from "./components/NotificationBell";
import "./globals.css";

export const metadata = {
  title: "CodeSphere AI",
  description: "Ask questions about your codebase. Auto-triage new issues.",
};

export default function RootLayout({ children }) {
  const isSignedIn = Boolean(cookies().get("session_user_id"));

  return (
    <html lang="en">
      <body>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.85rem 1.5rem",
            borderBottom: "1px solid var(--border)",
            boxShadow: "0 2px 16px rgba(0,0,0,0.25)",
            background: "var(--surface)",
          }}
        >
          <a
            href="/"
            style={{
              textDecoration: "none",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1.05rem",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 2,
                background: "var(--accent)",
              }}
            />
            CodeSphere AI
          </a>
          {isSignedIn && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <NotificationBell />
              <SignOutButton />
            </div>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}
