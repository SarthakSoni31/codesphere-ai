"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [repos, setRepos] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    // Fetch connected repositories for quick search
    fetch("/api/repositories")
      .then((res) => (res.ok ? res.json() : { repositories: [] }))
      .then((data) => setRepos(data.repositories || []))
      .catch(() => {});
  }, []);

  // Keyboard shortcut listener: "/" or "Cmd+K" / "Ctrl+K" focuses search
  useEffect(() => {
    function handleKeyDown(e) {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable);

      if (e.key === "/" && !isInput) {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredRepos = query.trim()
    ? repos.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          r.owner.toLowerCase().includes(query.toLowerCase())
      )
    : repos.slice(0, 5);

  function handleSelectRepo(repo, view = "chat") {
    setIsOpen(false);
    setQuery("");
    // If on dashboard, dispatch custom event for instant in-page switch
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("codesphere:open-repo", {
          detail: { repoId: repo.id, repo, view },
        })
      );
      window.history.pushState({}, "", `/dashboard?repo=${repo.id}`);
      if (!window.location.pathname.startsWith("/dashboard")) {
        router.push(`/dashboard?repo=${repo.id}`);
      }
    }
  }

  function handleAction(action) {
    setIsOpen(false);
    setQuery("");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("codesphere:action", { detail: { action } }));
      if (!window.location.pathname.startsWith("/dashboard")) {
        router.push("/dashboard");
      }
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        className="gh-header-search"
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        style={{
          cursor: "text",
          borderColor: isOpen ? "var(--accent)" : "var(--border)",
          boxShadow: isOpen ? "0 0 0 2px rgba(88, 166, 255, 0.2)" : "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          minWidth: 320,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="currentColor"
          style={{ opacity: 0.6, flexShrink: 0 }}
        >
          <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"></path>
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filteredRepos.length > 0) {
              e.preventDefault();
              handleSelectRepo(filteredRepos[0]);
            }
          }}
          placeholder="Search repositories, code, actions..."
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text)",
            fontSize: "13px",
            width: "100%",
            padding: 0,
            fontFamily: "inherit",
          }}
        />

        {query ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              inputRef.current?.focus();
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              padding: 0,
              fontSize: "12px",
              lineHeight: 1,
            }}
            title="Clear search"
          >
            ✕
          </button>
        ) : (
          <kbd className="gh-kbd" title="Press / to focus search">
            /
          </kbd>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: "100%",
            minWidth: 360,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
            zIndex: 1000,
            overflow: "hidden",
            maxHeight: 380,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Repositories section */}
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--surface-raised)", fontSize: "11px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {query.trim() ? "Matching Repositories" : "Connected Repositories"}
          </div>

          <div style={{ overflowY: "auto", maxHeight: 220 }}>
            {filteredRepos.length > 0 ? (
              filteredRepos.map((r, i) => (
                <div
                  key={r.id}
                  onClick={() => handleSelectRepo(r)}
                  style={{
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    borderBottom: i < filteredRepos.length - 1 ? "1px solid var(--border)" : "none",
                    background: i === selectedIndex ? "var(--surface-raised)" : "transparent",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ color: "var(--muted)" }}>
                      <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25H12v1.5H5.25a.25.25 0 0 1-.25-.25Z"></path>
                    </svg>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)" }}>
                      {r.owner}/<strong style={{ color: "var(--accent)" }}>{r.name}</strong>
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {r.chunkCount || 0} chunks
                    </span>
                    {r.groundingRate !== null && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 10,
                          background: r.groundingRate >= 85 ? "rgba(35, 134, 54, 0.15)" : "rgba(210, 153, 34, 0.15)",
                          color: r.groundingRate >= 85 ? "var(--success)" : "var(--warning)",
                          border: `1px solid ${r.groundingRate >= 85 ? "rgba(46, 160, 67, 0.3)" : "rgba(210, 153, 34, 0.3)"}`,
                        }}
                      >
                        {r.groundingRate}%
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
                No connected repositories found matching &ldquo;{query}&rdquo;
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", background: "var(--surface-raised)", fontSize: "11px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Quick Actions
          </div>
          <div style={{ padding: "4px 6px" }}>
            <div
              onClick={() => handleAction("connect")}
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 4,
                cursor: "pointer",
                fontSize: "12px",
                color: "var(--text)",
              }}
              className="gh-menu-item"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style={{ color: "var(--accent)" }}>
                <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z" />
              </svg>
              <span>Connect a new GitHub repository</span>
            </div>

            <div
              onClick={() => handleAction("assignments")}
              style={{
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 4,
                cursor: "pointer",
                fontSize: "12px",
                color: "var(--text)",
              }}
              className="gh-menu-item"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style={{ color: "var(--muted)" }}>
                <path d="M2.5 1.75v11.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H2.75a.25.25 0 0 0-.25.25Zm-1.5 0C1 .784 1.784 0 2.75 0h10.5C14.216 0 15 .784 15 1.75v11.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V1.75Z"></path>
              </svg>
              <span>View team tasks &amp; assignments</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
