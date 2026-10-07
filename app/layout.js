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
            <a href="/" className="brand-logo-link" title="CodeSphere on GitHub">
              <svg height="30" viewBox="0 0 24 24" width="30" fill="currentColor" style={{ color: "#ffffff" }}>
                <path d="M12.5.75C6.146.75 1 5.896 1 12.25c0 5.089 3.292 9.387 7.863 10.91.575.101.79-.244.79-.546 0-.272-.014-1.178-.014-2.142-2.88.531-3.624-.7-3.851-1.336-.129-.331-.689-1.336-1.178-1.608-.403-.215-.977-.748-.014-.762.906-.014 1.553.834 1.769 1.179 1.035 1.74 2.688 1.25 3.349.948.1-.747.402-1.25.733-1.538-2.559-.287-5.232-1.279-5.232-5.678 0-1.25.445-2.285 1.178-3.09-.115-.288-.517-1.467.115-3.048 0 0 .963-.302 3.163 1.179.92-.259 1.897-.388 2.875-.388.977 0 1.955.13 2.875.388 2.2-1.495 3.162-1.179 3.162-1.179.633 1.581.23 2.76.115 3.048.733.805 1.179 1.825 1.179 3.09 0 4.413-2.688 5.39-5.247 5.678.417.36.776 1.05.776 2.128 0 1.538-.014 2.774-.014 3.162 0 .302.216.662.79.547C20.709 21.637 24 17.324 24 12.25 24 5.896 18.854.75 12.5.75Z"></path>
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
