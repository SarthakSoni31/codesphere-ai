import { cookies } from "next/headers";
import SignOutButton from "./components/SignOutButton";
import NotificationBell from "./components/NotificationBell";
import "./globals.css";

export const metadata = {
  title: "CodeSphere — Codebase Intelligence & Auto-Triage",
  description: "Grounded codebase question answering, issue triage, and module ownership for engineering teams.",
};

export default function RootLayout({ children }) {
  const isSignedIn = Boolean(cookies().get("session_user_id"));

  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a href="/" className="brand-logo-link" title="CodeSphere">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="#30363d" strokeWidth="1.75" />
                <circle cx="12" cy="12" r="5" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 2" />
                <path d="M8.5 9.5L6 12L8.5 14.5" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15.5 9.5L18 12L15.5 14.5" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="brand-name" style={{ fontWeight: 600, fontSize: "14px", color: "#f0f6fc", letterSpacing: "0.01em" }}>
                CodeSphere
              </span>
            </a>

            <div className="gh-header-search">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.6 }}>
                <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"></path>
              </svg>
              <span>Type <kbd className="gh-kbd">/</kbd> to search</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isSignedIn ? (
              <>
                <NotificationBell />
                <SignOutButton />
              </>
            ) : (
              <a href="/api/auth/github" className="btn btn-primary" style={{ fontSize: "13px" }}>
                Sign in with GitHub
              </a>
            )}
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
