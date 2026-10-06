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
          <a href="/" className="brand-logo-link">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="brand-logo-svg"
            >
              <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.2" />
              <ellipse cx="12" cy="12" rx="4.5" ry="9.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="2 2" />
              <path d="M8 9.5L5.5 12L8 14.5" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 9.5L18.5 12L16 14.5" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 7.5L11 16.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span className="brand-name">CodeSphere</span>
          </a>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {isSignedIn ? (
              <>
                <NotificationBell />
                <SignOutButton />
              </>
            ) : (
              <a href="/api/auth/github" className="btn btn-secondary header-login-btn">
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
