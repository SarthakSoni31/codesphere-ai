import { cookies } from "next/headers";
import SignOutButton from "./components/SignOutButton";
import NotificationBell from "./components/NotificationBell";
import HeaderSearch from "./components/HeaderSearch";
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

            <HeaderSearch />
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
