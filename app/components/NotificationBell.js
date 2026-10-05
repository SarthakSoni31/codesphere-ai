"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export default function NotificationBell() {
  const [assignments, setAssignments] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const load = useCallback(() => {
    fetch("/api/my-assignments")
      .then((res) => (res.ok ? res.json() : { assignments: [] }))
      .then((data) => setAssignments(data.assignments || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // Light polling so a new assignment shows up without a full page reload.
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markRead(id, read = true) {
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: read } : a)));
    await fetch("/api/my-assignments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId: id, read }),
    });
  }

  const unreadCount = assignments.filter((a) => !a.isRead).length;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "relative",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 8,
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "var(--text)",
        }}
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "var(--accent)",
              color: "#1a1206",
              fontSize: "0.65rem",
              fontWeight: 700,
              borderRadius: 999,
              minWidth: 16,
              height: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 340,
            maxHeight: 420,
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            zIndex: 50,
          }}
        >
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "0.85rem" }}>
            Notifications
          </div>
          {assignments.length === 0 && (
            <p style={{ padding: "1rem", color: "var(--muted-2)", fontSize: "0.82rem", margin: 0 }}>
              Nothing assigned to you yet.
            </p>
          )}
          {assignments.map((a) => (
            <div
              key={a.id}
              style={{
                padding: "0.65rem 1rem",
                borderBottom: "1px solid var(--border)",
                background: a.isRead ? "transparent" : "var(--accent-wash)",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.82rem" }}>
                <strong>{a.assignedBy || "Someone"}</strong> assigned you{" "}
                <span className="mono">{a.filePath}</span>
              </p>
              <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>
                {a.repositoryOwner}/{a.repositoryName}
                {a.deadline && (
                  <span style={{ color: "var(--accent)" }}> · due {new Date(a.deadline).toLocaleDateString()}</span>
                )}
              </p>
              {!a.isRead && (
                <button
                  onClick={() => markRead(a.id, true)}
                  style={{
                    marginTop: 6,
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    fontSize: "0.72rem",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Mark as read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
