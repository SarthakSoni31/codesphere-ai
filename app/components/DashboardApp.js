"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";

export default function DashboardApp() {
  const [teamRepos, setTeamRepos] = useState([]);
  const [loadingTeamRepos, setLoadingTeamRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null); // { id, owner, name, chunkCount, indexedBy, indexedByUserId }
  const [view, setView] = useState("chat"); // "chat" | "dashboard" | "team" | "discussion" | "assignments"
  const [showConnectForm, setShowConnectForm] = useState(false);

  const [currentUser, setCurrentUser] = useState(null); // { id, login }
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroundingRepo, setSelectedGroundingRepo] = useState(null);
  const [selectedDeepIndexRepo, setSelectedDeepIndexRepo] = useState(null);

  const fetchTeamRepos = useCallback(async () => {
    setLoadingTeamRepos(true);
    try {
      const res = await fetch("/api/repositories");
      const data = await res.json();
      if (res.ok) setTeamRepos(data.repositories);
      return data.repositories || [];
    } catch {
      // Non-fatal — the connect-new-repo flow still works without this list.
      return [];
    } finally {
      setLoadingTeamRepos(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamRepos();

    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setCurrentUser(data))
      .catch(() => {});
  }, [fetchTeamRepos]);

  function selectRepo(repo, initialView = "chat") {
    setSelectedRepo(repo);
    setView(initialView);
    setShowConnectForm(false);
  }

  async function deleteRepo(repo) {
    const confirmed = window.confirm(
      `Delete ${repo.owner}/${repo.name}? This removes all its indexed chunks, discussion, and assignments for the whole team. This can't be undone.`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/repositories/${repo.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete repository.");
      return;
    }

    if (selectedRepo?.id === repo.id) setSelectedRepo(null);
    fetchTeamRepos();
  }

  async function handleIndexed(indexedRepoId) {
    const repos = await fetchTeamRepos();
    const fresh = repos.find((r) => r.id === indexedRepoId);
    setSelectedRepo(fresh || null);
    setView("chat");
    setShowConnectForm(false);
  }

  const filteredRepos = teamRepos.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.owner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="gh-profile-wrapper">
      {showConnectForm && (
        <div className="gh-repo-content-container" style={{ maxWidth: 720, margin: "24px auto" }}>
          <button
            onClick={() => setShowConnectForm(false)}
            className="btn"
            style={{ marginBottom: 16, fontSize: "12px" }}
          >
            &larr; Back to repositories
          </button>
          <ConnectRepoView onIndexed={handleIndexed} onCancel={() => setShowConnectForm(false)} />
        </div>
      )}

      {!showConnectForm && !selectedRepo && (
        <HomeView
          currentUser={currentUser}
          teamRepos={teamRepos}
          onOpenRepo={(id, initialView = "chat") => {
            const repo = teamRepos.find((r) => r.id === id);
            if (repo) selectRepo(repo, initialView);
          }}
          onConnectNew={() => setShowConnectForm(true)}
          onDeleteRepo={deleteRepo}
          onOpenGroundingModal={(r) => setSelectedGroundingRepo(r)}
          onOpenDeepIndexModal={(r) => setSelectedDeepIndexRepo(r)}
        />
      )}

      {!showConnectForm && selectedRepo && (
        <div>
          {/* GitHub Repository Header */}
          <div className="gh-repo-header">
            <div className="gh-repo-header-top">
              <div className="gh-repo-crumb">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ color: "var(--muted)" }}>
                  <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25H12v1.5H5.25a.25.25 0 0 1-.25-.25Z"></path>
                </svg>
                <span
                  className="gh-repo-crumb-owner"
                  onClick={() => setSelectedRepo(null)}
                  title="Back to profile and repositories"
                >
                  {selectedRepo.owner}
                </span>
                <span style={{ color: "var(--muted)", margin: "0 2px" }}>/</span>
                <span className="gh-repo-crumb-name">{selectedRepo.name}</span>
                <span className="gh-repo-badge">Public</span>
              </div>

              <div className="gh-repo-actions-strip">
                <button
                  className="btn"
                  onClick={() => setSelectedRepo(null)}
                  style={{ fontSize: "12px", padding: "4px 10px" }}
                >
                  &larr; Repositories
                </button>
                <button
                  className="btn"
                  onClick={() => setSelectedDeepIndexRepo(selectedRepo)}
                  style={{
                    fontSize: "12px",
                    padding: "4px 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 600,
                  }}
                  title="Multi-pass progressive Deep Index for large codebases"
                >
                  <span style={{ fontSize: "12px" }}>⚡</span>
                  <span>Deep Index ({selectedRepo.chunkCount || 0})</span>
                </button>
                <button
                  className="btn"
                  onClick={() => setSelectedGroundingRepo(selectedRepo)}
                  style={{
                    fontSize: "12px",
                    padding: "4px 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    borderColor: (selectedRepo.groundingRate !== null && selectedRepo.groundingRate >= 85) ? "rgba(46, 160, 67, 0.4)" : "rgba(210, 153, 34, 0.4)",
                    color: (selectedRepo.groundingRate !== null && selectedRepo.groundingRate >= 85) ? "var(--success)" : "var(--warning)",
                    background: (selectedRepo.groundingRate !== null && selectedRepo.groundingRate >= 85) ? "rgba(35, 134, 54, 0.1)" : "rgba(210, 153, 34, 0.1)",
                    fontWeight: 600,
                  }}
                  title="Grounding health & verification"
                >
                  <span style={{ fontSize: "11px" }}>
                    {selectedRepo.groundingRate !== null && selectedRepo.groundingRate >= 85 ? "✓" : "⚠"}
                  </span>
                  <span>
                    Grounding: {selectedRepo.groundingRate !== null ? `${selectedRepo.groundingRate}%` : "Unverified"}
                  </span>
                </button>
                <button className="gh-filter-btn" style={{ fontSize: "12px" }}>
                  Watch ▾
                </button>
                <button className="gh-filter-btn" style={{ fontSize: "12px" }}>
                  Fork ▾
                </button>
                <button className="gh-star-btn">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path>
                  </svg>
                  <span>Star</span>
                  <span style={{ fontSize: "10px", opacity: 0.7 }}>▾</span>
                </button>
                <a
                  href={`https://github.com/${selectedRepo.owner}/${selectedRepo.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{ fontSize: "12px", padding: "4px 10px" }}
                  title="Open on GitHub"
                >
                  GitHub ↗
                </a>
              </div>
            </div>

            {/* Horizontal GitHub Repo Subnav Tabs */}
            <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
              <button
                className={`gh-subnav-tab ${view === "code" ? "active" : ""}`}
                onClick={() => setView("code")}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"></path>
                </svg>
                <span>Code</span>
              </button>

              <button
                className={`gh-subnav-tab ${view === "dashboard" || view === "issues" ? "active" : ""}`}
                onClick={() => setView("dashboard")}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path>
                  <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path>
                </svg>
                <span>Issues</span>
              </button>

              <button
                className={`gh-subnav-tab ${view === "pulls" ? "active" : ""}`}
                onClick={() => setView("pulls")}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.25 2.25 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.5 5.396l2.323-2.323a.75.75 0 0 1 1.06 1.06L10.56 6.457l2.324 2.323a.75.75 0 0 1-1.06 1.06L9.5 7.518 7.177 9.84a.75.75 0 0 1-1.06-1.06L8.44 6.457 6.116 4.134a.75.75 0 0 1 1.06-1.06ZM3 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm0 9.5a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"></path>
                </svg>
                <span>Pull requests</span>
              </button>

              <button
                className={`gh-subnav-tab ${view === "chat" ? "active" : ""}`}
                onClick={() => setView("chat")}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M7.998 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Z"></path>
                </svg>
                <span>Copilot</span>
              </button>

              <button
                className={`gh-subnav-tab ${view === "discussion" ? "active" : ""}`}
                onClick={() => setView("discussion")}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v9.5C0 13.216.784 14 1.75 14H3v1.543a1.458 1.458 0 0 0 2.488 1.03l2.873-2.573h5.889A1.75 1.75 0 0 0 16 12.25v-9.5A1.75 1.75 0 0 0 14.25 1H1.75Z"></path>
                </svg>
                <span>Discussions</span>
              </button>

              <button
                className={`gh-subnav-tab ${view === "assignments" ? "active" : ""}`}
                onClick={() => setView("assignments")}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.5 1.75v11.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H2.75a.25.25 0 0 0-.25.25Zm-1.5 0C1 .784 1.784 0 2.75 0h10.5C14.216 0 15 .784 15 1.75v11.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V1.75Z"></path>
                </svg>
                <span>Assignments</span>
              </button>

              <button
                className={`gh-subnav-tab ${view === "team" ? "active" : ""}`}
                onClick={() => setView("team")}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4.002 4.002 0 0 0-7.898 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5Z"></path>
                </svg>
                <span>Contributors</span>
              </button>
            </div>
          </div>

          {/* Repo Workspace Content */}
          <div className="gh-repo-content-container">
            {(selectedRepo.groundingRate === null || selectedRepo.groundingRate < 85) && (
              <div
                style={{
                  background: "rgba(210, 153, 34, 0.08)",
                  border: "1px solid rgba(210, 153, 34, 0.35)",
                  borderRadius: 6,
                  padding: "12px 16px",
                  marginBottom: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "16px" }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--warning)" }}>
                      Grounding Target Alert: {selectedRepo.groundingRate !== null ? `${selectedRepo.groundingRate}%` : "Unverified"} (Required: ≥85.0%)
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 2 }}>
                      This repository requires a verified grounding rate over 85% to ensure Copilot answers and issue triage bots cite actual lines without hallucination.
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => setSelectedGroundingRepo(selectedRepo)}
                  style={{ fontSize: "12px", padding: "5px 12px" }}
                >
                  Follow Optimization Steps &rarr;
                </button>
              </div>
            )}

            {view === "code" && (
              <RepoCodeOverview
                repo={selectedRepo}
                onNavigateTab={setView}
                onOpenGroundingModal={() => setSelectedGroundingRepo(selectedRepo)}
                onOpenDeepIndexModal={() => setSelectedDeepIndexRepo(selectedRepo)}
              />
            )}
            {(view === "dashboard" || view === "issues") && <DashboardView repo={selectedRepo} />}
            {view === "pulls" && <PullRequestsView repo={selectedRepo} onNavigateTab={setView} />}
            {view === "chat" && <ChatView repo={selectedRepo} onRepoUpdated={fetchTeamRepos} />}
            {view === "team" && <TeamView repo={selectedRepo} />}
            {view === "discussion" && <DiscussionView repo={selectedRepo} />}
            {view === "assignments" && <AssignmentsView repo={selectedRepo} currentUser={currentUser} />}
          </div>
        </div>
      )}

      {selectedGroundingRepo && (
        <GroundingHealthModal
          repo={selectedGroundingRepo}
          onClose={() => setSelectedGroundingRepo(null)}
          onRepoUpdated={async () => {
            const repos = await fetchTeamRepos();
            if (selectedRepo) {
              const fresh = repos.find((r) => r.id === selectedRepo.id);
              if (fresh) setSelectedRepo(fresh);
            }
          }}
          onNavigateTab={(tab) => {
            selectRepo(selectedGroundingRepo, tab);
            setSelectedGroundingRepo(null);
          }}
          onOpenDeepIndexModal={(r) => setSelectedDeepIndexRepo(r)}
        />
      )}

      {selectedDeepIndexRepo && (
        <DeepIndexModal
          repo={selectedDeepIndexRepo}
          onClose={() => setSelectedDeepIndexRepo(null)}
          onRepoUpdated={async () => {
            const repos = await fetchTeamRepos();
            if (selectedRepo) {
              const fresh = repos.find((r) => r.id === selectedRepo.id);
              if (fresh) setSelectedRepo(fresh);
            }
          }}
          onOpenGroundingModal={(r) => setSelectedGroundingRepo(r)}
        />
      )}
    </div>
  );
}

function HomeView({ currentUser, teamRepos = [], onOpenRepo, onConnectNew, onDeleteRepo, onOpenGroundingModal, onOpenDeepIndexModal }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState("repos"); // "repos" | "assignments"

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/my-assignments")
      .then((res) => (res.ok ? res.json() : { assignments: [] }))
      .then((data) => setAssignments(data.assignments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id, read = true) {
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: read } : a)));
    await fetch("/api/my-assignments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId: id, read }),
    });
  }

  const overdue = assignments.filter((a) => a.deadline && new Date(a.deadline) < new Date() && !a.isRead);
  const upcoming = assignments.filter((a) => !overdue.includes(a));
  const totalChunks = teamRepos.reduce((acc, r) => acc + (Number(r.chunkCount) || 0), 0);
  const totalQueriesAll = teamRepos.reduce((acc, r) => acc + (Number(r.totalQueries) || 0), 0);
  const groundedQueriesAll = teamRepos.reduce((acc, r) => acc + (Number(r.groundedQueries) || 0), 0);
  const overallGroundingRate = totalQueriesAll > 0 ? Number(((groundedQueriesAll / totalQueriesAll) * 100).toFixed(1)) : null;
  const compliantRepos = teamRepos.filter((r) => r.groundingRate !== null && r.groundingRate >= 85.0);

  const filteredRepos = teamRepos.filter((r) => {
    if (!searchFilter) return true;
    const term = searchFilter.toLowerCase();
    return r.name.toLowerCase().includes(term) || r.owner.toLowerCase().includes(term);
  });

  return (
    <div className="gh-repo-content-container" style={{ maxWidth: 1140, margin: "0 auto", padding: "24px 20px" }}>
      {/* Workspace Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              WORKSPACE
            </span>
            {currentUser && (
              <span className="badge" style={{ fontSize: "11px" }}>
                @{currentUser.login}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 600, margin: 0, color: "var(--text)" }}>
            Repository Intelligence &amp; Triage
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: 4, marginBottom: 0 }}>
            Grounded codebase Q&amp;A, automated issue triage, memory leak scanning, and one-click PR generation.
          </p>
        </div>

        <button className="btn btn-primary" onClick={onConnectNew} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25H12v1.5H5.25a.25.25 0 0 1-.25-.25Z"></path>
          </svg>
          <span>Connect repository</span>
        </button>
      </div>

      {/* Metrics Strip */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 20px",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Repositories</div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)" }}>{teamRepos.length}</div>
          </div>
          <div style={{ width: 1, height: 28, background: "var(--border)" }} />
          <div>
            <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Vector Chunks</div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--text)" }}>{totalChunks.toLocaleString()}</div>
          </div>
          <div style={{ width: 1, height: 28, background: "var(--border)" }} />
          <div>
            <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Assigned Tasks</div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: overdue.length > 0 ? "var(--danger)" : "var(--text)" }}>
              {assignments.length} {overdue.length > 0 && <span style={{ fontSize: "12px", color: "var(--danger)" }}>({overdue.length} overdue)</span>}
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: "var(--border)" }} />
          <div>
            <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Grounding Health (≥85% Target)</div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: compliantRepos.length === teamRepos.length && teamRepos.length > 0 ? "var(--success)" : "var(--warning)" }}>
              {compliantRepos.length}/{teamRepos.length} Met
              <span style={{ fontSize: "11px", fontWeight: 400, marginLeft: 6, color: "var(--muted)" }}>
                ({overallGroundingRate !== null ? `${overallGroundingRate}% avg` : "pending"})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Subnav Tabs */}
      <div style={{ borderBottom: "1px solid var(--border)", display: "flex", gap: 12, marginBottom: 20 }}>
        <button
          className={`gh-subnav-tab ${activeTab === "repos" ? "active" : ""}`}
          onClick={() => setActiveTab("repos")}
          style={{ padding: "8px 12px", fontSize: "14px" }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25H12v1.5H5.25a.25.25 0 0 1-.25-.25Z"></path>
          </svg>
          <span>Repositories</span>
          <span className="gh-counter-pill">{teamRepos.length}</span>
        </button>

        <button
          className={`gh-subnav-tab ${activeTab === "assignments" ? "active" : ""}`}
          onClick={() => setActiveTab("assignments")}
          style={{ padding: "8px 12px", fontSize: "14px" }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.5 1.75v11.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H2.75a.25.25 0 0 0-.25.25Zm-1.5 0C1 .784 1.784 0 2.75 0h10.5C14.216 0 15 .784 15 1.75v11.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V1.75Z"></path>
          </svg>
          <span>Assigned Tasks</span>
          <span className="gh-counter-pill">{assignments.length}</span>
        </button>
      </div>

      {/* Tab: Repositories List */}
      {activeTab === "repos" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
            <input
              type="text"
              className="gh-filter-input"
              placeholder="Filter repositories by name or owner..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{ maxWidth: 360 }}
            />
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Showing {filteredRepos.length} connected repos
            </span>
          </div>

          {filteredRepos.length === 0 ? (
            <div className="card" style={{ padding: "40px 20px", textAlign: "center" }}>
              <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor" style={{ color: "var(--muted)", marginBottom: 12 }}>
                <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25H12v1.5H5.25a.25.25 0 0 1-.25-.25Z"></path>
              </svg>
              <h4 style={{ margin: "0 0 6px", fontSize: "15px" }}>No repositories connected yet</h4>
              <p style={{ color: "var(--muted)", fontSize: "13px", maxWidth: 440, margin: "0 auto 16px" }}>
                Connect a GitHub repository to index its source files, chat with the codebase, and automate issue triage.
              </p>
              <button className="btn btn-primary" onClick={onConnectNew}>
                Connect repository &rarr;
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {filteredRepos.map((r, i) => (
                <div
                  key={r.id}
                  style={{
                    padding: "16px 20px",
                    borderBottom: i < filteredRepos.length - 1 ? "1px solid var(--border)" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span
                        className="gh-repo-link"
                        onClick={() => onOpenRepo(r.id, "chat")}
                        style={{ fontSize: "16px" }}
                      >
                        {r.owner}/{r.name}
                      </span>
                      <span className="gh-repo-badge">Public</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: "12px", color: "var(--muted)", flexWrap: "wrap" }}>
                      <span><strong>{r.chunkCount || 0}</strong> chunks indexed</span>
                      <span>Branch: <code>{r.default_branch || "main"}</code></span>
                      <span>Connected by @{r.indexedBy || "team"}</span>
                      {r.indexedAt && (
                        <span>{new Date(r.indexedAt).toLocaleDateString()}</span>
                      )}
                      {r.groundingRate !== null ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenGroundingModal) onOpenGroundingModal(r);
                          }}
                          style={{
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontWeight: 600,
                            fontSize: "11px",
                            background: r.groundingRate >= 85 ? "rgba(35, 134, 54, 0.15)" : "rgba(248, 81, 73, 0.15)",
                            color: r.groundingRate >= 85 ? "var(--success)" : "var(--danger)",
                            border: `1px solid ${r.groundingRate >= 85 ? "rgba(46, 160, 67, 0.4)" : "rgba(248, 81, 73, 0.4)"}`,
                          }}
                          title="Click to view grounding verification and remediation steps"
                        >
                          <span>{r.groundingRate >= 85 ? "✓" : "⚠"}</span>
                          <span>{r.groundingRate}% Grounded {r.groundingRate >= 85 ? "(≥85% Met)" : "(Action Required)"}</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenGroundingModal) onOpenGroundingModal(r);
                          }}
                          style={{
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontWeight: 600,
                            fontSize: "11px",
                            background: "rgba(210, 153, 34, 0.15)",
                            color: "var(--warning)",
                            border: "1px solid rgba(210, 153, 34, 0.4)",
                          }}
                          title="Click to run automated grounding health check"
                        >
                          <span>⚡</span>
                          <span>Unverified (Run Health Check)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <button
                      className="btn"
                      onClick={() => onOpenDeepIndexModal && onOpenDeepIndexModal(r)}
                      style={{
                        fontSize: "12px",
                        padding: "4px 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      title="Progressively deep-index code files without serverless timeouts"
                    >
                      <span>⚡</span>
                      <span>Deep Index</span>
                    </button>
                    <button
                      className="btn"
                      onClick={() => onOpenGroundingModal && onOpenGroundingModal(r)}
                      style={{
                        fontSize: "12px",
                        padding: "4px 10px",
                        color: (r.groundingRate !== null && r.groundingRate >= 85) ? "var(--text)" : "var(--warning)",
                        borderColor: (r.groundingRate !== null && r.groundingRate >= 85) ? "var(--border)" : "var(--warning)",
                      }}
                      title="Inspect grounding score or follow optimization steps"
                    >
                      Grounding Health
                    </button>
                    <button className="btn btn-primary" onClick={() => onOpenRepo(r.id, "chat")} style={{ fontSize: "12px", padding: "4px 10px" }}>
                      Assistant
                    </button>
                    <button className="btn" onClick={() => onOpenRepo(r.id, "dashboard")} style={{ fontSize: "12px", padding: "4px 10px" }}>
                      Issues &amp; Triage
                    </button>
                    <button className="btn" onClick={() => onOpenRepo(r.id, "assignments")} style={{ fontSize: "12px", padding: "4px 10px" }}>
                      Assignments
                    </button>

                    {currentUser && r.indexedByUserId === currentUser.id && (
                      <button
                        onClick={() => onDeleteRepo(r)}
                        className="btn"
                        style={{ fontSize: "12px", padding: "4px 8px", color: "var(--danger)" }}
                        title="Delete repository"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Assigned Tasks */}
      {activeTab === "assignments" && (
        <div>
          {loading && <p className="empty-state">Loading your tasks...</p>}

          {!loading && assignments.length === 0 && (
            <div className="card" style={{ padding: "32px", textAlign: "center" }}>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px" }}>
                No tasks currently assigned to your account.
              </p>
            </div>
          )}

          {overdue.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ color: "var(--danger)", fontSize: "13px", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Overdue Tasks ({overdue.length})
              </h4>
              <TaskList tasks={overdue} onMarkRead={markRead} onOpenRepo={onOpenRepo} />
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <h4 style={{ fontSize: "13px", margin: "0 0 8px", color: "var(--text)" }}>
                Active Tasks ({upcoming.length})
              </h4>
              <TaskList tasks={upcoming} onMarkRead={markRead} onOpenRepo={onOpenRepo} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RepoCodeOverview({ repo, onNavigateTab, onOpenGroundingModal, onOpenDeepIndexModal }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="gh-filter-btn" style={{ fontSize: "13px" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v5.256a2.25 2.25 0 1 0 1.5 0V5.372Zm-1.5 7.378a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0ZM12.5 4.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 2.122a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Zm-1.75 3.878a2.25 2.25 0 0 0-2.25-2.25H7.5v-1.5h1a.75.75 0 0 0 0-1.5h-1V3.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 .75.75h1.75a.75.75 0 0 1 .75.75v.878a2.25 2.25 0 1 0 1.5 0ZM10.25 13a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Z"></path>
            </svg>
            <span>{repo.default_branch || "main"}</span>
            <span style={{ fontSize: "10px", opacity: 0.7 }}>▾</span>
          </button>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>
            <strong>1</strong> branch &bull; <strong>{repo.chunkCount}</strong> indexed chunks
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => onOpenDeepIndexModal && onOpenDeepIndexModal(repo)}>
            ⚡ Deep Index ({repo.chunkCount})
          </button>
          <button className="btn btn-primary" onClick={() => onNavigateTab("chat")}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.998 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Z"></path>
            </svg>
            Ask Copilot
          </button>
          <button className="btn" onClick={() => onNavigateTab("dashboard")}>
            Triage Issues
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "12px 16px", background: "var(--surface-raised)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: "13px" }}>@{repo.indexedBy || repo.owner}</span>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Indexed repository for team collaboration &amp; AI triage</span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
            {repo.indexedAt ? new Date(repo.indexedAt).toLocaleDateString() : "Recently"}
          </span>
        </div>

        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: 4 }}>EMBEDDING MODEL</div>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>all-MiniLM-L6-v2 (ONNX)</div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>384 dimensional local vectors</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: 4 }}>SEMANTIC CHUNKS</div>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>{repo.chunkCount} code blocks</div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {repo.fileCount ? `${repo.fileCount} files indexed • ` : "Vector indexed via pgvector • "}
                <button
                  onClick={() => onOpenDeepIndexModal && onOpenDeepIndexModal(repo)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--accent)",
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontSize: "12px",
                  }}
                >
                  Deep Index ⚡
                </button>
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: 4 }}>GROUNDING HEALTH</div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: (repo.groundingRate !== null && repo.groundingRate >= 85) ? "var(--success)" : "var(--warning)" }}>
                {repo.groundingRate !== null ? `${repo.groundingRate}% accuracy` : "Unverified"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {repo.groundingRate !== null && repo.groundingRate >= 85 ? "Target met (≥85%)" : "Target: ≥85.0% required"} &bull;{" "}
                <button
                  onClick={() => onOpenGroundingModal && onOpenGroundingModal(repo)}
                  style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer", textDecoration: "underline", fontSize: "12px" }}
                >
                  {repo.groundingRate !== null && repo.groundingRate >= 85 ? "View report" : "Follow steps"}
                </button>
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: 4 }}>PR AUTOMATION</div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent)" }}>Ready</div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>Fork-aware branch push</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "20px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "15px" }}>README.md</h3>
        <div style={{ fontSize: "14px", color: "var(--text)", lineHeight: 1.6 }}>
          <p>
            <strong>{repo.owner}/{repo.name}</strong> is connected to CodeSphere.
          </p>
          <p style={{ color: "var(--muted)" }}>
            Use the <strong>Issues</strong> tab to scan for potential memory leaks, stale issues, and auto-generate pull requests.
            Use <strong>Copilot</strong> to ask architecture and logic questions grounded in the actual codebase files.
          </p>
        </div>
      </div>
    </div>
  );
}

function PullRequestsView({ repo, onNavigateTab }) {
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        const delivered = data.deliveredSolutions || {};
        const list = Object.entries(delivered)
          .filter(([_, d]) => d.pr)
          .map(([num, d]) => ({
            issueNumber: num,
            ...d.pr,
          }));
        setPrs(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [repo.owner, repo.name]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: "14px" }}>Pull requests</span>
          <span className="gh-counter-pill">{prs.length}</span>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigateTab("dashboard")}>
          Create PR from issue
        </button>
      </div>

      {loading && <p className="empty-state">Loading pull requests...</p>}

      {!loading && prs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor" style={{ color: "var(--muted)", marginBottom: 12 }}>
            <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.25 2.25 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.5 5.396l2.323-2.323a.75.75 0 0 1 1.06 1.06L10.56 6.457l2.324 2.323a.75.75 0 0 1-1.06 1.06L9.5 7.518 7.177 9.84a.75.75 0 0 1-1.06-1.06L8.44 6.457 6.116 4.134a.75.75 0 0 1 1.06-1.06ZM3 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm0 9.5a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"></path>
          </svg>
          <h4 style={{ margin: "0 0 6px" }}>No pull requests delivered yet</h4>
          <p style={{ color: "var(--muted)", fontSize: "13px", maxWidth: 460, margin: "0 auto 16px" }}>
            Go to the Issues tab to solve an issue with AI and click &quot;Open Pull Request on GitHub&quot; to automatically push a fix branch and open a PR.
          </p>
          <button className="btn btn-primary" onClick={() => onNavigateTab("dashboard")}>
            Go to Issues &rarr;
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {prs.map((pr) => (
            <div
              key={pr.number || pr.issueNumber}
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ color: "var(--success)", marginTop: 3 }}>
                  <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.25 2.25 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.5 5.396l2.323-2.323a.75.75 0 0 1 1.06 1.06L10.56 6.457l2.324 2.323a.75.75 0 0 1-1.06 1.06L9.5 7.518 7.177 9.84a.75.75 0 0 1-1.06-1.06L8.44 6.457 6.116 4.134a.75.75 0 0 1 1.06-1.06ZM3 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm0 9.5a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"></path>
                </svg>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>
                    <a href={pr.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text)", textDecoration: "none" }}>
                      Fix for Issue #{pr.issueNumber} ({pr.branch || `fix/issue-${pr.issueNumber}`})
                    </a>
                    <span className="badge" style={{ marginLeft: 8, color: "var(--success)", borderColor: "var(--success)" }}>
                      Delivered via CodeSphere
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                    #{pr.number || "PR"} &bull; target branch <code>main</code> &bull; created {new Date(pr.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {pr.url && (
                <a href={pr.url} target="_blank" rel="noopener noreferrer" className="btn" style={{ fontSize: "12px" }}>
                  View on GitHub &rarr;
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskList({ tasks, onMarkRead, onOpenRepo }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tasks.map((a) => (
        <div
          key={a.id}
          className="card"
          style={{ padding: "0.75rem 1rem", borderColor: a.isRead ? "var(--border)" : "var(--accent)" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.88rem" }}>
                <strong>{a.assignedBy || "Someone"}</strong> assigned you{" "}
                <span className="mono">{a.filePath}</span>
              </p>
              <button
                onClick={() => onOpenRepo(a.repositoryId)}
                className="mono"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  padding: 0,
                  marginTop: 4,
                }}
              >
                {a.repositoryOwner}/{a.repositoryName} →
              </button>
            </div>
            {a.deadline && (
              <span className="badge" style={{ color: "var(--accent)", borderColor: "var(--accent)", flexShrink: 0 }}>
                due {new Date(a.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
          {!a.isRead && (
            <button
              onClick={() => onMarkRead(a.id, true)}
              className="btn"
              style={{ marginTop: 10, fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
            >
              Mark as read
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function ConnectRepoView({ onIndexed, onCancel }) {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null); // { repositoryId, filesIndexed, chunksIndexed, skipped }
  const [showSkipped, setShowSkipped] = useState(false);

  async function connectAndIndex() {
    setIndexing(true);
    setResult(null);
    setStatus("Connecting repository and indexing core source files...");
    try {
      const res = await fetch("/api/index-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: owner.trim(), repo: repo.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.repositoryId) {
        setStatus("");
        setResult(data);
      } else {
        setStatus(`Error: ${data.error || "indexing failed (HTTP " + res.status + ")"}`);
      }
    } catch (err) {
      if (err.name === "AbortError" || err.message?.includes("Load failed") || err.message?.includes("Failed to fetch")) {
        setStatus("Error: Connection interrupted or timed out. Please check network and retry.");
      } else {
        setStatus(`Error: ${err.message}`);
      }
    } finally {
      setIndexing(false);
    }
  }

  const skipped = result?.skipped;
  const totalSkipped = skipped ? skipped.unsupportedType + skipped.overFileCap : 0;

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>Connect a repository</h2>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: -8 }}>
        Indexes the repo&apos;s source files so anyone on the team can ask questions about it.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input className="input" placeholder="owner (e.g. facebook)" value={owner} onChange={(e) => setOwner(e.target.value)} disabled={indexing || !!result} />
        <input className="input" placeholder="repo (e.g. react)" value={repo} onChange={(e) => setRepo(e.target.value)} disabled={indexing || !!result} />
      </div>

      {!result && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary" onClick={connectAndIndex} disabled={indexing || !owner || !repo}>
            {indexing ? "Indexing..." : "Index repository"}
          </button>
          <button className="btn" onClick={onCancel} disabled={indexing}>
            Cancel
          </button>
        </div>
      )}
      {status && <p style={{ color: "var(--muted)", marginTop: 12, fontSize: "0.85rem" }}>{status}</p>}

      {result && (
        <div style={{ marginTop: 14 }}>
          <p style={{ color: "var(--success)", fontSize: "0.88rem", margin: 0 }}>
            ✓ Indexed {result.filesIndexed} files ({result.chunksIndexed} chunks).
          </p>

          {totalSkipped > 0 && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => setShowSkipped((s) => !s)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.8rem", cursor: "pointer", padding: 0 }}
              >
                {showSkipped ? "▾" : "▸"} {totalSkipped} file{totalSkipped === 1 ? "" : "s"} weren&apos;t indexed — click to see why
              </button>
              {showSkipped && (
                <div style={{ marginTop: 8, background: "var(--surface-raised)", borderRadius: 8, padding: "0.75rem" }}>
                  {skipped.unsupportedType > 0 && (
                    <div style={{ marginBottom: skipped.overFileCap > 0 ? 10 : 0 }}>
                      <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0 0 4px" }}>
                        {skipped.unsupportedType} unsupported file type or too large (images, binaries, lockfiles, etc.):
                      </p>
                      {skipped.unsupportedSample.map((p) => (
                        <p key={p} className="mono" style={{ fontSize: "0.72rem", color: "var(--muted-2)", margin: "2px 0" }}>
                          {p}
                        </p>
                      ))}
                      {skipped.unsupportedType > skipped.unsupportedSample.length && (
                        <p style={{ fontSize: "0.72rem", color: "var(--muted-2)", margin: "2px 0" }}>
                          ...and {skipped.unsupportedType - skipped.unsupportedSample.length} more
                        </p>
                      )}
                    </div>
                  )}
                  {skipped.overFileCap > 0 && (
                    <div>
                      <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0 0 4px" }}>
                        {skipped.overFileCap} secondary files deferred (available on-demand via Just-In-Time retrieval):
                      </p>
                      {skipped.overFileCapSample.map((p) => (
                        <p key={p} className="mono" style={{ fontSize: "0.72rem", color: "var(--muted-2)", margin: "2px 0" }}>
                          {p}
                        </p>
                      ))}
                      {skipped.overFileCap > skipped.overFileCapSample.length && (
                        <p style={{ fontSize: "0.72rem", color: "var(--muted-2)", margin: "2px 0" }}>
                          ...and {skipped.overFileCap - skipped.overFileCapSample.length} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => onIndexed(result.repositoryId)}>
              Continue to chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatView({ repo, onRepoUpdated }) {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    setLoadingHistory(true);
    fetch(`/api/chat-history?repositoryId=${repo.id}`)
      .then((res) => (res.ok ? res.json() : { history: [] }))
      .then((data) => {
        setChatHistory(
          (data.history || []).map((h) => ({ question: h.question, answer: h.answer, sources: h.sources }))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [repo.id]);

  async function askQuestion() {
    if (!question.trim()) return;
    setAsking(true);
    const askedQuestion = question;
    setQuestion("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: repo.id, question: askedQuestion }),
      });
      const data = await res.json();
      setChatHistory((h) => [
        ...h,
        { question: askedQuestion, answer: data.answer || `Error: ${data.error}`, sources: data.sources },
      ]);
      if (onRepoUpdated) onRepoUpdated();
    } catch (err) {
      setChatHistory((h) => [...h, { question: askedQuestion, answer: `Error: ${err.message}`, sources: [] }]);
    } finally {
      setAsking(false);
    }
  }

  async function clearChat() {
    const confirmed = window.confirm("Clear your chat history for this repo? This can't be undone.");
    if (!confirmed) return;
    setChatHistory([]);
    await fetch(`/api/chat-history?repositoryId=${repo.id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "1.3rem", marginBottom: 4 }}>
            {repo.owner}/{repo.name}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: 20 }}>
            Ask anything about this codebase — answers are grounded in the indexed source and cite exact files.
          </p>
        </div>
        {chatHistory.length > 0 && (
          <button className="btn" onClick={clearChat} style={{ fontSize: "0.78rem", padding: "0.4rem 0.7rem", flexShrink: 0 }}>
            Clear chat
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Where is authentication handled?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && askQuestion()}
        />
        <button className="btn btn-primary" onClick={askQuestion} disabled={asking}>
          {asking ? "Thinking..." : "Ask"}
        </button>
      </div>

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        {loadingHistory && <p className="empty-state">Loading your previous questions...</p>}
        {!loadingHistory && chatHistory.length === 0 && (
          <p className="empty-state">No questions yet — ask something about the code above.</p>
        )}
        {chatHistory.map((turn, i) => (
          <div key={i} className="card">
            <p style={{ fontWeight: 600, marginTop: 0 }}>{turn.question}</p>
            <div className="markdown-body">
              <ReactMarkdown>{turn.answer}</ReactMarkdown>
            </div>
            {turn.sources?.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.72rem", color: "var(--muted)", marginRight: 2 }}>Sources cited:</span>
                {turn.sources.map((s) => {
                  const match = s.match(/^(.+?):(\d+)-(\d+)$/);
                  const file = match ? match[1] : s;
                  const hash = match ? `#L${match[2]}-L${match[3]}` : "";
                  const branch = repo.default_branch || "main";
                  const url = `https://github.com/${repo.owner}/${repo.name}/blob/${branch}/${file}${hash}`;
                  return (
                    <a
                      key={s}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-chip mono"
                      title={`Open ${s} on GitHub`}
                      style={{
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        cursor: "pointer",
                      }}
                    >
                      <span>{s}</span>
                      <span style={{ fontSize: "10px", opacity: 0.7 }}>↗</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardView({ repo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deliveredSolutions, setDeliveredSolutions] = useState({});
  const [issueTab, setIssueTab] = useState("stale"); // "stale" | "all"

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dashboard?owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
        setDeliveredSolutions(json.deliveredSolutions || {});
      } else {
        setError(json.error || "Failed to load dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSolutionDelivered(issueNumber, type, details) {
    setDeliveredSolutions((prev) => {
      const existing = prev[issueNumber] || { comment: null, pr: null };
      if (type === "pr") {
        return {
          ...prev,
          [issueNumber]: {
            ...existing,
            pr: {
              number: details.number,
              url: details.url,
              branch: details.branch,
              createdAt: new Date().toISOString(),
            },
          },
        };
      } else if (type === "comment") {
        return {
          ...prev,
          [issueNumber]: {
            ...existing,
            comment: {
              url: details.url,
              createdAt: new Date().toISOString(),
            },
          },
        };
      }
      return prev;
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo.id]);

  const displayedIssues =
    data && (issueTab === "all" ? (data.allOpenIssues || data.staleIssues) : data.staleIssues);
  const deliveredCount =
    displayedIssues ? displayedIssues.filter((i) => deliveredSolutions[i.number]?.pr || deliveredSolutions[i.number]?.comment).length : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "1.3rem", margin: 0 }}>Backlog health</h1>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh from GitHub"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)", marginTop: 12 }}>{error}</p>}
      {data && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <Stat label="Open issues" value={data.backlogHealth.openCount} />
            <Stat label="Stale (14+ days)" value={data.backlogHealth.staleCount} />
            <Stat
              label="Solutions delivered"
              value={`${Object.values(deliveredSolutions).filter((d) => d.pr || d.comment).length} issues`}
            />
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Issue resolution</h3>
                <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: 6, padding: 2, border: "1px solid var(--border)" }}>
                  <button
                    className="btn"
                    style={{
                      fontSize: "0.72rem",
                      padding: "0.2rem 0.6rem",
                      background: issueTab === "stale" ? "var(--surface-raised)" : "transparent",
                      border: "none",
                      color: issueTab === "stale" ? "var(--text)" : "var(--muted)",
                      fontWeight: issueTab === "stale" ? 600 : 400,
                    }}
                    onClick={() => setIssueTab("stale")}
                  >
                    Stale ({data.staleIssues.length})
                  </button>
                  <button
                    className="btn"
                    style={{
                      fontSize: "0.72rem",
                      padding: "0.2rem 0.6rem",
                      background: issueTab === "all" ? "var(--surface-raised)" : "transparent",
                      border: "none",
                      color: issueTab === "all" ? "var(--text)" : "var(--muted)",
                      fontWeight: issueTab === "all" ? 600 : 400,
                    }}
                    onClick={() => setIssueTab("all")}
                  >
                    All open ({data.allOpenIssues?.length || data.backlogHealth.openCount})
                  </button>
                </div>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Delivered in view: <strong style={{ color: "var(--success)" }}>{deliveredCount}</strong> / {displayedIssues.length}
              </span>
            </div>

            {displayedIssues.length === 0 && <p className="empty-state">No issues in this view.</p>}
            {displayedIssues.map((i) => (
              <StaleIssueRow
                key={i.number}
                issue={i}
                repo={repo}
                delivery={deliveredSolutions[i.number]}
                onDelivered={handleSolutionDelivered}
              />
            ))}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Module ownership</h3>
            {data.moduleOwnership.length === 0 && (
              <p className="empty-state">No commits in the last 30 days to attribute yet.</p>
            )}
            {data.moduleOwnership.map((m) => (
              <p key={m.module} style={{ fontSize: "0.85rem", margin: "6px 0" }}>
                <span className="mono">{m.module}/</span> → mostly <strong>{m.owner}</strong> ({m.commits} recent
                commits)
              </p>
            ))}
          </div>

          <BugScanCard
            repo={repo}
            deliveredSolutions={deliveredSolutions}
            onDelivered={handleSolutionDelivered}
          />
        </div>
      )}
    </div>
  );
}

function BugScanFindingRow({ finding, index, repo, deliveredSolutions = {}, onDelivered, filed, onFile }) {
  const [openSolve, setOpenSolve] = useState(false);
  const [solutionText, setSolutionText] = useState("");
  const [generatingSolution, setGeneratingSolution] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [postSuccess, setPostSuccess] = useState(null);
  const [postError, setPostError] = useState("");
  const [creatingPR, setCreatingPR] = useState(false);
  const [prSuccess, setPrSuccess] = useState(null);
  const [prError, setPrError] = useState("");

  const issueNumber = filed?.number;
  const delivery = issueNumber ? deliveredSolutions[issueNumber] : null;
  const effectivePr = prSuccess || delivery?.pr;
  const effectiveComment = postSuccess || delivery?.comment;

  async function generateSolution() {
    setGeneratingSolution(true);
    setPostError("");
    setPrError("");
    try {
      const res = await fetch("/api/generate-solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryId: repo.id,
          title: `[Bug finding] ${finding.filePath || ""}: ${finding.issue.slice(0, 70)}`,
          issueBody: `File: ${finding.filePath || "N/A"}\nCategory: ${finding.category || "Bug"}\nIssue: ${finding.issue}`,
        }),
      });
      const data = await res.json();
      if (res.ok) setSolutionText(data.solution);
      else setPostError(data.error || "Failed to generate solution");
    } catch (err) {
      setPostError(err.message);
    } finally {
      setGeneratingSolution(false);
    }
  }

  async function handleCreatePR() {
    if (!solutionText.trim() || !issueNumber) return;
    setCreatingPR(true);
    setPrError("");
    try {
      const res = await fetch("/api/create-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.name,
          issueNumber,
          title: `fix: resolve AI bug finding #${issueNumber} (${finding.filePath || ""})`,
          body: solutionText,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPrSuccess(data);
        onDelivered?.(issueNumber, "pr", data);
      } else {
        setPrError(data.error || "Failed to create PR");
      }
    } catch (err) {
      setPrError(err.message);
    } finally {
      setCreatingPR(false);
    }
  }

  async function postSolution() {
    if (!solutionText.trim() || !issueNumber) return;
    setPostingComment(true);
    setPostError("");
    try {
      const res = await fetch("/api/post-issue-solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.name,
          issueNumber,
          comment: solutionText,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPostSuccess({ url: data.url });
        onDelivered?.(issueNumber, "comment", data);
      } else {
        setPostError(data.error || "Failed to post solution");
      }
    } catch (err) {
      setPostError(err.message);
    } finally {
      setPostingComment(false);
    }
  }

  return (
    <div style={{ padding: "0.75rem 0.9rem", background: "var(--surface-raised)", borderRadius: 8, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            {finding.filePath && <span className="mono" style={{ fontSize: "0.78rem", color: "var(--accent)" }}>{finding.filePath}</span>}
            {finding.category && <span className="badge">{finding.category}</span>}
            {issueNumber && (
              <a
                href={filed.url}
                target="_blank"
                rel="noreferrer"
                className="mono"
                style={{ fontSize: "0.75rem", color: "var(--muted)", textDecoration: "underline" }}
              >
                #{issueNumber}
              </a>
            )}
          </div>
          <p style={{ fontSize: "0.85rem", margin: 0, lineHeight: 1.45 }}>{finding.issue}</p>
        </div>

        {/* Status / Delivery Column */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {effectivePr ? (
            <a
              href={effectivePr.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "var(--success)",
                background: "rgba(34, 197, 94, 0.12)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                borderRadius: 4,
                padding: "0.2rem 0.5rem",
                textDecoration: "none",
              }}
            >
              ✓ PR #{effectivePr.number} Delivered
            </a>
          ) : effectiveComment ? (
            <a
              href={effectiveComment.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "var(--accent)",
                background: "rgba(59, 130, 246, 0.12)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: 4,
                padding: "0.2rem 0.5rem",
                textDecoration: "none",
              }}
            >
              ✓ Solution Delivered
            </a>
          ) : !filed ? (
            <button
              className="btn btn-primary"
              style={{ fontSize: "0.72rem", padding: "0.25rem 0.55rem" }}
              onClick={() => onFile(finding, index)}
            >
              File as issue
            </button>
          ) : filed === "filing" ? (
            <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Filing...</span>
          ) : filed.error ? (
            <span style={{ fontSize: "0.7rem", color: "var(--danger)" }}>{filed.error}</span>
          ) : (
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--muted-2)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "0.2rem 0.5rem",
              }}
            >
              Pending fix
            </span>
          )}

          {issueNumber && (
            <button
              className="btn"
              style={{ fontSize: "0.72rem", padding: "0.25rem 0.55rem" }}
              onClick={() => {
                setOpenSolve((prev) => !prev);
                if (!solutionText && !openSolve) generateSolution();
              }}
            >
              {openSolve ? "Hide fix" : "Draft fix / PR"}
            </button>
          )}
        </div>
      </div>

      {openSolve && issueNumber && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          {generatingSolution && <p className="empty-state" style={{ padding: "0.4rem 0" }}>Formulating code solution for AI finding...</p>}
          {postError && <p style={{ color: "var(--danger)", fontSize: "0.78rem" }}>{postError}</p>}
          {prError && <p style={{ color: "var(--danger)", fontSize: "0.78rem" }}>{prError}</p>}

          {solutionText && (
            <div>
              <textarea
                className="input"
                style={{
                  width: "100%",
                  minHeight: 140,
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.78rem",
                  lineHeight: 1.55,
                  padding: "0.5rem 0.7rem",
                  background: "var(--surface)",
                  boxSizing: "border-box",
                }}
                value={solutionText}
                onChange={(e) => setSolutionText(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: "0.74rem", padding: "0.3rem 0.65rem" }}
                  onClick={postSolution}
                  disabled={postingComment || !solutionText.trim()}
                >
                  {postingComment ? "Posting..." : `Push Solution to Issue #${issueNumber}`}
                </button>
                <button
                  className="btn"
                  style={{ fontSize: "0.74rem", padding: "0.3rem 0.65rem", background: "var(--surface)", borderColor: "var(--accent)", color: "var(--accent)" }}
                  onClick={handleCreatePR}
                  disabled={creatingPR || !solutionText.trim()}
                >
                  {creatingPR ? "Creating PR..." : "Open Pull Request on GitHub"}
                </button>
                {effectiveComment && (
                  <span style={{ fontSize: "0.74rem", color: "var(--success)" }}>
                    ✓ Comment posted
                  </span>
                )}
                {effectivePr && (
                  <span style={{ fontSize: "0.74rem", color: "var(--success)" }}>
                    ✓ PR #{effectivePr.number} opened
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BugScanCard({ repo, deliveredSolutions = {}, onDelivered }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null); // { findings, scannedFiles }
  const [error, setError] = useState("");
  const [filed, setFiled] = useState({}); // findingIndex -> { url, number } | "filing" | "error"

  async function runScan() {
    setScanning(true);
    setError("");
    setFiled({});
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: repo.id }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else setError(data.error || "Scan failed");
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  async function fileAsIssue(finding, index) {
    setFiled((f) => ({ ...f, [index]: "filing" }));
    const title = `[Auto-flagged] ${finding.filePath ? finding.filePath + ": " : ""}${finding.issue.slice(0, 70)}${finding.issue.length > 70 ? "..." : ""}`;
    try {
      const res = await fetch("/api/file-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: repo.owner, repo: repo.name, title, body: finding.issue }),
      });
      const data = await res.json();
      if (res.ok) setFiled((f) => ({ ...f, [index]: data }));
      else setFiled((f) => ({ ...f, [index]: { error: data.error } }));
    } catch (err) {
      setFiled((f) => ({ ...f, [index]: { error: err.message } }));
    }
  }

  async function fileAll() {
    for (let i = 0; i < result.findings.length; i++) {
      if (!filed[i] || filed[i].error) {
        await fileAsIssue(result.findings[i], i);
      }
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Automatic bug scan</h3>
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "4px 0 0" }}>
            Reads full files (not just fragments) hunting for logic errors, security issues, and
            unhandled edge cases — the kind of thing a linter can&apos;t catch. A starting point, not a
            guarantee.
          </p>
        </div>
        <button className="btn" onClick={runScan} disabled={scanning}>
          {scanning ? "Scanning..." : "Scan for bugs"}
        </button>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginTop: 10 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ color: "var(--muted-2)", fontSize: "0.75rem", margin: 0 }}>
              Reviewed {result.scannedFiles} file{result.scannedFiles === 1 ? "" : "s"} from the indexed set.
            </p>
            {result.findings.length > 0 && (
              <button className="btn" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }} onClick={fileAll}>
                File all as GitHub issues
              </button>
            )}
          </div>
          {result.findings.length === 0 && (
            <p className="empty-state">No obvious issues flagged in the sampled files.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.findings.map((f, i) => (
              <BugScanFindingRow
                key={i}
                finding={f}
                index={i}
                repo={repo}
                filed={filed[i]}
                deliveredSolutions={deliveredSolutions}
                onDelivered={onDelivered}
                onFile={fileAsIssue}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StaleIssueRow({ issue, repo, delivery = null, onDelivered = null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [help, setHelp] = useState(null); // { answer, sources }
  const [error, setError] = useState("");

  const [solutionText, setSolutionText] = useState("");
  const [generatingSolution, setGeneratingSolution] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [postSuccess, setPostSuccess] = useState(null);
  const [postError, setPostError] = useState("");

  const [creatingPR, setCreatingPR] = useState(false);
  const [prSuccess, setPrSuccess] = useState(null);
  const [prError, setPrError] = useState("");
  const [copied, setCopied] = useState(false);

  const effectivePr = prSuccess || delivery?.pr;
  const effectiveComment = postSuccess || delivery?.comment;

  function copySolution() {
    if (!solutionText) return;
    navigator.clipboard.writeText(solutionText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCreatePR() {
    if (!solutionText.trim()) return;
    setCreatingPR(true);
    setPrError("");
    setPrSuccess(null);
    try {
      const res = await fetch("/api/create-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.name,
          issueNumber: issue.number,
          title: `fix: resolve issue #${issue.number} (${issue.title.slice(0, 50)})`,
          body: solutionText,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPrSuccess(data);
        onDelivered?.(issue.number, "pr", data);
      } else {
        setPrError(data.error || "Failed to create Pull Request");
      }
    } catch (err) {
      setPrError(err.message);
    } finally {
      setCreatingPR(false);
    }
  }

  async function getHelp() {
    setOpen(true);
    if (help) return; // already fetched, just toggling open
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/issue-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: repo.id, title: issue.title, issueBody: issue.body }),
      });
      const data = await res.json();
      if (res.ok) setHelp(data);
      else setError(data.error || "Failed to get help");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateSolution() {
    setGeneratingSolution(true);
    setPostError("");
    setPostSuccess(null);
    try {
      const res = await fetch("/api/generate-solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryId: repo.id,
          title: issue.title,
          issueBody: issue.body,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSolutionText(data.solution);
      } else {
        setPostError(data.error || "Failed to generate solution");
      }
    } catch (err) {
      setPostError(err.message);
    } finally {
      setGeneratingSolution(false);
    }
  }

  async function postSolution() {
    if (!solutionText.trim()) return;
    setPostingComment(true);
    setPostError("");
    setPostSuccess(null);
    try {
      const res = await fetch("/api/post-issue-solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.name,
          issueNumber: issue.number,
          comment: solutionText,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPostSuccess({ url: data.url });
        onDelivered?.(issue.number, "comment", data);
      } else {
        setPostError(data.error || "Failed to post solution to GitHub");
      }
    } catch (err) {
      setPostError(err.message);
    } finally {
      setPostingComment(false);
    }
  }

  return (
    <div style={{ margin: "8px 0", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <p style={{ fontSize: "0.85rem", margin: 0, minWidth: 0 }}>
          <span className="mono" style={{ color: "var(--muted)" }}>
            #{issue.number}
          </span>{" "}
          {issue.title} — last touched {new Date(issue.updatedAt).toLocaleDateString()}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {effectivePr ? (
            <a
              href={effectivePr.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "var(--success)",
                background: "rgba(34, 197, 94, 0.12)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                borderRadius: 4,
                padding: "0.2rem 0.5rem",
                textDecoration: "none",
              }}
            >
              ✓ PR #{effectivePr.number} Delivered
            </a>
          ) : effectiveComment ? (
            <a
              href={effectiveComment.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "var(--accent)",
                background: "rgba(59, 130, 246, 0.12)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: 4,
                padding: "0.2rem 0.5rem",
                textDecoration: "none",
              }}
            >
              ✓ Solution Delivered
            </a>
          ) : (
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--muted-2)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "0.2rem 0.5rem",
              }}
            >
              Pending
            </span>
          )}

          <button
            className="btn"
            style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
            onClick={() => (open ? setOpen(false) : getHelp())}
          >
            {open ? "Hide" : "Get AI help"}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 8, background: "var(--surface-raised)", borderRadius: 8, padding: "0.75rem" }}>
          {loading && <p className="empty-state" style={{ padding: 0 }}>Thinking...</p>}
          {error && <p style={{ color: "var(--danger)", fontSize: "0.82rem", margin: 0 }}>{error}</p>}
          {help && (
            <>
              <div className="markdown-body">
                <ReactMarkdown>{help.answer}</ReactMarkdown>
              </div>
              {help.sources?.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)", marginRight: 2 }}>Sources cited:</span>
                  {help.sources.map((s) => {
                    const match = s.match(/^(.+?):(\d+)-(\d+)$/);
                    const file = match ? match[1] : s;
                    const hash = match ? `#L${match[2]}-L${match[3]}` : "";
                    const branch = repo.default_branch || "main";
                    const url = `https://github.com/${repo.owner}/${repo.name}/blob/${branch}/${file}${hash}`;
                    return (
                      <a
                        key={s}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-chip mono"
                        title={`Open ${s} on GitHub`}
                        style={{
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          cursor: "pointer",
                        }}
                      >
                        <span>{s}</span>
                        <span style={{ fontSize: "10px", opacity: 0.7 }}>↗</span>
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Solution Formulation & Direct GitHub Push */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Proposed Fix &amp; Solution</span>
                  {!solutionText && !generatingSolution && (
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: "0.74rem", padding: "0.25rem 0.65rem" }}
                      onClick={generateSolution}
                    >
                      Draft Code Solution
                    </button>
                  )}
                </div>

                {generatingSolution && (
                  <p className="empty-state" style={{ padding: "0.4rem 0" }}>
                    Formulating grounded code fix and verification steps...
                  </p>
                )}

                {solutionText && (
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 6px" }}>
                      Review or edit the fix below before pushing it directly to Issue #{issue.number} on GitHub:
                    </p>
                    <textarea
                      className="input"
                      style={{
                        width: "100%",
                        minHeight: 180,
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.78rem",
                        lineHeight: 1.55,
                        padding: "0.6rem 0.75rem",
                        resize: "vertical",
                        background: "var(--surface)",
                        boxSizing: "border-box",
                      }}
                      value={solutionText}
                      onChange={(e) => setSolutionText(e.target.value)}
                    />

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: "0.76rem", padding: "0.35rem 0.75rem" }}
                          onClick={postSolution}
                          disabled={postingComment || !solutionText.trim()}
                        >
                          {postingComment ? "Posting to GitHub..." : `Push Solution to Issue #${issue.number}`}
                        </button>
                        <button
                          className="btn"
                          style={{ fontSize: "0.76rem", padding: "0.35rem 0.75rem", background: "var(--surface)", borderColor: "var(--accent)", color: "var(--accent)" }}
                          onClick={handleCreatePR}
                          disabled={creatingPR || !solutionText.trim()}
                        >
                          {creatingPR ? "Creating PR..." : "Open Pull Request on GitHub"}
                        </button>
                        <button
                          className="btn"
                          style={{ fontSize: "0.74rem", padding: "0.35rem 0.6rem" }}
                          onClick={copySolution}
                        >
                          {copied ? "✓ Copied" : "Copy"}
                        </button>
                        <button
                          className="btn"
                          style={{ fontSize: "0.74rem", padding: "0.35rem 0.6rem" }}
                          onClick={generateSolution}
                          disabled={generatingSolution}
                        >
                          Re-generate
                        </button>
                      </div>

                      {postSuccess && (
                        <span style={{ fontSize: "0.78rem", color: "var(--success)" }}>
                          ✓ Solution posted to Issue #{issue.number} —{" "}
                          <a
                            href={postSuccess.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--success)", textDecoration: "underline" }}
                          >
                            View on GitHub &rarr;
                          </a>
                        </span>
                      )}
                      {postError && (
                        <span style={{ fontSize: "0.78rem", color: "var(--danger)" }}>
                          {postError}
                        </span>
                      )}
                      {prSuccess && (
                        <span style={{ fontSize: "0.78rem", color: "var(--success)" }}>
                          ✓ PR #{prSuccess.number} opened on GitHub{prSuccess.isFork && prSuccess.forkOwner ? ` (via fork ${prSuccess.forkOwner}/${repo.name})` : ""} —{" "}
                          <a
                            href={prSuccess.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--success)", textDecoration: "underline" }}
                          >
                            View Pull Request &rarr;
                          </a>
                        </span>
                      )}
                      {prError && (
                        <span style={{ fontSize: "0.78rem", color: "var(--danger)" }}>
                          {prError}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 700 }}>{value}</div>
      <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{label}</div>
    </div>
  );
}

function TeamView({ repo }) {
  const [collaborators, setCollaborators] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/collaborators?owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) setCollaborators(data.collaborators);
        else setError(data.error);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo.id]);

  return (
    <div>
      <h1 style={{ fontSize: "1.3rem", marginBottom: 4 }}>Who&apos;s invited to this repo</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: 20 }}>
        Pulled live from GitHub — everyone with access to {repo.owner}/{repo.name}.
      </p>

      {loading && <p className="empty-state">Loading...</p>}
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {collaborators && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {collaborators.map((c) => (
            <div key={c.login} className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.avatarUrl} alt={c.login} className="avatar-img" />
              <span style={{ flex: 1, fontWeight: 500 }}>{c.login}</span>
              <span className={`badge ${c.role === "admin" ? "badge-admin" : c.role === "write" ? "badge-write" : ""}`}>
                {c.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiscussionView({ repo }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?repositoryId=${repo.id}`);
      const data = await res.json();
      if (res.ok) setMessages(data.messages);
    } finally {
      setLoading(false);
    }
  }, [repo.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: repo.id, message: text }),
      });
      setText("");
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "1.3rem", margin: 0 }}>Team discussion</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 4 }}>
            A shared thread for the whole team about {repo.owner}/{repo.name} — not AI, just you and your
            teammates.
          </p>
        </div>
        <button className="btn" onClick={load}>
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {loading && <p className="empty-state">Loading...</p>}
        {!loading && messages.length === 0 && (
          <p className="empty-state">No messages yet — start the conversation below.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="card" style={{ padding: "0.75rem 1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{m.author}</span>
              <span style={{ color: "var(--muted-2)", fontSize: "0.72rem" }}>
                {new Date(m.createdAt).toLocaleString()}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{m.message}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Say something to the team..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn btn-primary" onClick={send} disabled={sending || !text.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

function AssignmentsView({ repo, currentUser }) {
  const [files, setFiles] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingAssignee, setPendingAssignee] = useState({}); // filePath -> selected user id
  const [pendingDeadline, setPendingDeadline] = useState({}); // filePath -> selected date
  const [error, setError] = useState("");

  const isAdmin = currentUser && repo.indexedByUserId === currentUser.id;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    // allSettled so one flaky request (e.g. a transient DB hiccup) doesn't
    // blank out data we already successfully fetched from the other call.
    const [filesResult, membersResult] = await Promise.allSettled([
      fetch(`/api/assignments?repositoryId=${repo.id}`).then((r) => r.json()),
      fetch("/api/team-members").then((r) => r.json()),
    ]);
    if (filesResult.status === "fulfilled") setFiles(filesResult.value.files || []);
    else setError("Couldn't load assignments — try refreshing.");
    if (membersResult.status === "fulfilled") setMembers(membersResult.value.members || []);
    setLoading(false);
  }, [repo.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function assign(filePath) {
    const assignedTo = pendingAssignee[filePath];
    if (!assignedTo) return;
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repositoryId: repo.id,
        filePath,
        assignedTo,
        deadline: pendingDeadline[filePath] || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to assign.");
      return;
    }
    load();
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.3rem", marginBottom: 4 }}>Assignments</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: 8 }}>
        Who&apos;s working on which file in {repo.owner}/{repo.name} — visible to the whole team.
      </p>
      {!isAdmin && (
        <p style={{ color: "var(--muted-2)", fontSize: "0.8rem", marginBottom: 16 }}>
          Only {repo.indexedBy || "the repo admin"} (whoever connected this repo) can assign tasks. You can
          view assignments below.
        </p>
      )}
      {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</p>}

      {loading && <p className="empty-state">Loading...</p>}
      {!loading && files.length === 0 && <p className="empty-state">No indexed files found for this repo.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {files.map((f) => (
          <div key={f.filePath} className="card" style={{ padding: "0.6rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="mono" style={{ flex: 1, fontSize: "0.82rem" }}>
                {f.filePath}
              </span>
              {f.assignedTo && <span className="badge badge-write">{f.assignedTo}</span>}
              {f.deadline && (
                <span className="badge" style={{ color: "var(--accent)", borderColor: "var(--accent)" }}>
                  due {new Date(f.deadline).toLocaleDateString()}
                </span>
              )}
            </div>
            {f.assignedTo && f.assignedBy && (
              <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--muted-2)" }}>
                Assigned by {f.assignedBy}
              </p>
            )}

            {isAdmin && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <select
                  className="input"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.5rem", flex: 1 }}
                  value={pendingAssignee[f.filePath] || ""}
                  onChange={(e) => setPendingAssignee((p) => ({ ...p, [f.filePath]: e.target.value }))}
                >
                  <option value="">{f.assignedTo ? "Reassign to..." : "Assign to..."}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.login}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="input"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
                  value={pendingDeadline[f.filePath] || ""}
                  onChange={(e) => setPendingDeadline((p) => ({ ...p, [f.filePath]: e.target.value }))}
                />
                <button
                  className="btn btn-primary"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.7rem" }}
                  onClick={() => assign(f.filePath)}
                  disabled={!pendingAssignee[f.filePath]}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function GroundingHealthModal({ repo, onClose, onRepoUpdated, onNavigateTab, onOpenDeepIndexModal }) {
  const [currentRepo, setCurrentRepo] = useState(repo);
  const [probing, setProbing] = useState(false);
  const [probeResults, setProbeResults] = useState(null);
  const [probeSummary, setProbeSummary] = useState(null);
  const [probeError, setProbeError] = useState(null);

  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState(null);

  const rate = currentRepo.groundingRate;
  const targetMet = rate !== null && rate >= 85.0;

  async function runProbe() {
    setProbing(true);
    setProbeError(null);
    setProbeResults(null);
    try {
      const res = await fetch(`/api/repositories/${currentRepo.id}/probe`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setProbeError(data.error || "Failed to execute grounding probe.");
        return;
      }
      setProbeResults(data.results || []);
      setProbeSummary({
        total: data.totalProbes,
        passed: data.passedProbes,
        rate: data.probeGroundingRate,
        overall: data.overallGroundingRate,
        targetMet: data.targetMet,
      });

      setCurrentRepo((prev) => ({
        ...prev,
        groundingRate: data.overallGroundingRate,
        groundedQueries: data.groundedQueries,
        totalQueries: data.totalQueries,
        targetMet: data.targetMet,
        groundingStatus: data.targetMet ? "healthy" : "failing",
      }));

      if (onRepoUpdated) onRepoUpdated();
    } catch (err) {
      setProbeError(err.message || "Failed to execute probe.");
    } finally {
      setProbing(false);
    }
  }

  async function runReindex() {
    setReindexing(true);
    setReindexMsg(null);
    try {
      const res = await fetch("/api/index-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: currentRepo.owner, repo: currentRepo.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReindexMsg(`Re-indexing failed: ${data.error || "Unknown error"}`);
        return;
      }
      setReindexMsg(`Successfully re-indexed ${data.chunksIndexed} chunks across ${data.filesIndexed} files.`);
      setCurrentRepo((prev) => ({ ...prev, chunkCount: data.chunksIndexed }));
      if (onRepoUpdated) onRepoUpdated();
    } catch (err) {
      setReindexMsg(`Re-indexing error: ${err.message}`);
    } finally {
      setReindexing(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--surface-raised)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "18px" }}>🎯</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>Grounding Health &amp; Verification</h3>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {currentRepo.owner}/{currentRepo.name} &bull; Target: &ge;85.0% Required
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn" style={{ padding: "4px 8px", fontSize: "12px" }}>
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px", overflowY: "auto", maxHeight: "calc(90vh - 120px)" }}>
          {/* Status Gauge Card */}
          <div
            className="card"
            style={{
              padding: "16px",
              marginBottom: 20,
              background: targetMet ? "rgba(35, 134, 54, 0.08)" : "rgba(210, 153, 34, 0.08)",
              border: `1px solid ${targetMet ? "rgba(46, 160, 67, 0.35)" : "rgba(210, 153, 34, 0.35)"}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
                  Current Reliability Status
                </span>
                <div style={{ fontSize: "18px", fontWeight: 700, color: targetMet ? "var(--success)" : "var(--warning)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{rate !== null ? `${rate}% Grounding Rate` : "Unverified"}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: targetMet ? "rgba(35, 134, 54, 0.2)" : "rgba(210, 153, 34, 0.2)",
                    }}
                  >
                    {targetMet ? "✓ Target Met (≥85.0%)" : "⚠ Below 85.0% Target"}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: "12px", color: "var(--muted)" }}>
                <div><strong>{currentRepo.groundedQueries || 0}</strong> of <strong>{currentRepo.totalQueries || 0}</strong> queries grounded</div>
                <div><strong>{currentRepo.chunkCount || 0}</strong> vector chunks in pgvector</div>
              </div>
            </div>

            {/* Visual Progress Bar with 85% marker */}
            <div style={{ position: "relative", marginBottom: 8 }}>
              <div className="grounding-progress-track">
                <div
                  className="grounding-progress-fill"
                  style={{
                    width: `${Math.min(100, Math.max(0, rate || 0))}%`,
                    background: targetMet ? "var(--success)" : "var(--warning)",
                  }}
                />
                <div className="grounding-target-marker" title="85.0% Engineering Threshold" />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", marginTop: 4 }}>
                <span>0%</span>
                <span style={{ position: "absolute", left: "85%", transform: "translateX(-50%)", color: "#f0f6fc", fontWeight: 600 }}>
                  85% Target
                </span>
                <span>100%</span>
              </div>
            </div>

            <p style={{ margin: "10px 0 0", fontSize: "12px", color: "var(--text)", lineHeight: 1.5 }}>
              {targetMet
                ? "This repository satisfies the verified source grounding standard. AI Copilot answers and auto-triage issue comments cite exact file paths and line ranges with zero hallucinations."
                : "This repository does not meet the required 85.0% threshold. Without verified source grounding, LLM answers risk hallucinating phantom functions or files. Follow the 4 steps below to optimize and verify grounding."}
            </p>
          </div>

          {/* 4-Step Remediation Plan */}
          <h4 style={{ fontSize: "13px", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
            Steps to Achieve &amp; Maintain &ge;85.0% Grounding
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Step 1 */}
            <div className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="badge" style={{ background: "var(--accent-wash)", color: "var(--accent)" }}>Step 1</span>
                    <strong style={{ fontSize: "13px" }}>Run Automated Grounding Health Probe</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                    Executes 20 automated test queries probing core modules across this repository to test whether pgvector retrieval locates the exact source lines.
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={runProbe}
                  disabled={probing}
                  style={{ fontSize: "12px", padding: "6px 14px", flexShrink: 0 }}
                >
                  {probing ? "Probing pgvector (20 Tests)..." : "Run Health Check Probe (20 Tests)"}
                </button>
              </div>

              {probeError && (
                <div style={{ marginTop: 10, fontSize: "12px", color: "var(--danger)" }}>
                  {probeError}
                </div>
              )}

              {probeSummary && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--surface-raised)", borderRadius: 6, fontSize: "12px" }}>
                  <div style={{ fontWeight: 600, color: probeSummary.targetMet ? "var(--success)" : "var(--warning)", marginBottom: 6 }}>
                    Probe Results: {probeSummary.passed}/{probeSummary.total} Passed ({probeSummary.rate}%) &bull; Overall Repo Grounding: {probeSummary.overall}%
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {probeResults.map((pr, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                        <span style={{ color: pr.passed ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                          [{pr.passed ? "PASS" : "FAIL"}]
                        </span>
                        <span style={{ color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {pr.filePath} &rarr; symbol: {pr.symbol}
                        </span>
                        {pr.sources.length > 0 && (
                          <span style={{ color: "var(--muted)" }}>{pr.sources[0]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2 */}
            <div className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="badge" style={{ background: "var(--accent-wash)", color: "var(--accent)" }}>Step 2</span>
                    <strong style={{ fontSize: "13px" }}>Re-Sync &amp; Re-Index Embeddings</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                    If code was refactored or files were deleted on GitHub, vector embeddings drift out of alignment. Re-indexing refreshes all code chunks in pgvector.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                  {onOpenDeepIndexModal && (
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        onClose();
                        onOpenDeepIndexModal(currentRepo);
                      }}
                      style={{ fontSize: "12px", padding: "6px 14px" }}
                      title="Progressive multi-pass deep indexing for all codebase files"
                    >
                      ⚡ Deep Index All Files
                    </button>
                  )}
                  <button
                    className="btn"
                    onClick={runReindex}
                    disabled={reindexing}
                    style={{ fontSize: "12px", padding: "6px 14px" }}
                  >
                    {reindexing ? "Indexing..." : "Re-Index Repository"}
                  </button>
                </div>
              </div>

              {reindexMsg && (
                <div style={{ marginTop: 10, fontSize: "12px", color: "var(--accent)" }}>
                  {reindexMsg}
                </div>
              )}
            </div>

            {/* Step 3 */}
            <div className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="badge" style={{ background: "var(--accent-wash)", color: "var(--accent)" }}>Step 3</span>
                <strong style={{ fontSize: "13px" }}>Audit Syntax Boundaries &amp; Indexable Extensions</strong>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                CodeSphere segments functions at AST boundaries. Ensure critical business logic, routes, and database models use supported languages (`.js`, `.jsx`, `.ts`, `.tsx`, `.py`, `.go`, `.rb`, `.java`). Avoid committing large minified bundles (&gt;500KB) into indexed folders.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: "11px", color: "var(--muted)" }}>
                <span style={{ padding: "2px 6px", background: "var(--surface-raised)", borderRadius: 4 }}>✓ AST chunking: active</span>
                <span style={{ padding: "2px 6px", background: "var(--surface-raised)", borderRadius: 4 }}>✓ 400 file cap</span>
                <span style={{ padding: "2px 6px", background: "var(--surface-raised)", borderRadius: 4 }}>✓ 2,000 chunk budget</span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="badge" style={{ background: "var(--accent-wash)", color: "var(--accent)" }}>Step 4</span>
                    <strong style={{ fontSize: "13px" }}>Execute Grounded In-Code Q&amp;A</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                    Ask specific architectural questions referencing concrete modules and symbols. Every answer that successfully grounds its claims with source citations raises your live score.
                  </p>
                </div>
                {onNavigateTab && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      onClose();
                      onNavigateTab("chat");
                    }}
                    style={{ fontSize: "12px", padding: "6px 14px", flexShrink: 0 }}
                  >
                    Open Copilot &rarr;
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", background: "var(--surface-raised)" }}>
          <button className="btn btn-primary" onClick={onClose} style={{ fontSize: "12px" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function DeepIndexModal({ repo, onClose, onRepoUpdated, onOpenGroundingModal }) {
  const [currentRepo, setCurrentRepo] = useState(repo);
  const [indexing, setIndexing] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [stats, setStats] = useState({
    totalChunks: Number(repo.chunkCount) || 0,
    totalFiles: Number(repo.fileCount) || 0,
    totalEligibleFiles: null,
    remainingUnindexedFiles: null,
    isFullyIndexed: false,
  });
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [cleanReindexing, setCleanReindexing] = useState(false);
  const stopRef = useRef(false);
  const passCountRef = useRef(0);

  async function executeBatch() {
    setIndexing(true);
    setError(null);
    setStatusMessage("Fetching repository tree and embedding next batch (~80 files, ~350 chunks)...");
    try {
      const res = await fetch("/api/index-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: currentRepo.owner,
          repo: currentRepo.name,
          append: true,
          mode: "deep",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Batch indexing failed.");
        setStatusMessage(null);
        return null;
      }

      setStats({
        totalChunks: data.totalChunks,
        totalFiles: data.totalFiles,
        totalEligibleFiles: data.totalEligibleFiles,
        remainingUnindexedFiles: data.remainingUnindexedFiles,
        isFullyIndexed: data.isFullyIndexed,
      });

      setCurrentRepo((prev) => ({
        ...prev,
        chunkCount: data.totalChunks,
        fileCount: data.totalFiles,
      }));

      const passNum = passCountRef.current + 1;
      passCountRef.current = passNum;

      const logEntry = {
        pass: passNum,
        chunksAdded: data.chunksIndexed,
        filesAdded: data.filesIndexed,
        totalChunks: data.totalChunks,
        totalFiles: data.totalFiles,
        totalEligible: data.totalEligibleFiles,
        isFullyIndexed: data.isFullyIndexed,
        timestamp: new Date().toLocaleTimeString(),
      };

      setLogs((prev) => [logEntry, ...prev]);

      if (data.isFullyIndexed || data.remainingUnindexedFiles === 0) {
        setStatusMessage(`All eligible source files indexed! 100% codebase coverage (${data.totalChunks} chunks across ${data.totalFiles} files).`);
      } else {
        setStatusMessage(`Pass ${passNum} complete: Added ${data.chunksIndexed} chunks across ${data.filesIndexed} files. ${data.remainingUnindexedFiles} files remaining.`);
      }

      if (onRepoUpdated) onRepoUpdated();
      return data;
    } catch (err) {
      setError(err.message || "Failed to execute batch index.");
      setStatusMessage(null);
      return null;
    } finally {
      setIndexing(false);
    }
  }

  async function startAutoDeepIndex() {
    setIsAutoRunning(true);
    stopRef.current = false;
    setError(null);

    while (!stopRef.current) {
      const data = await executeBatch();
      if (!data) break; // Error occurred, stop loop
      if (data.isFullyIndexed || data.remainingUnindexedFiles === 0) {
        break; // Finished completely
      }
      if (stopRef.current) break;
      // Brief breathing room between passes
      await new Promise((r) => setTimeout(r, 1500));
    }
    setIsAutoRunning(false);
  }

  function stopAutoDeepIndex() {
    stopRef.current = true;
    setIsAutoRunning(false);
    setStatusMessage("Auto deep-indexing stopped by user.");
  }

  async function handleCleanReindex() {
    const confirm = window.confirm(
      `Clean Re-Index will wipe existing embeddings for ${currentRepo.owner}/${currentRepo.name} and start fresh from Pass 1. Continue?`
    );
    if (!confirm) return;

    setCleanReindexing(true);
    setError(null);
    setStatusMessage("Wiping existing vector index and running fresh Pass 1...");
    try {
      const res = await fetch("/api/index-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: currentRepo.owner,
          repo: currentRepo.name,
          append: false, // Fresh index
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Clean re-indexing failed.");
        setStatusMessage(null);
        return;
      }

      passCountRef.current = 1;
      setStats({
        totalChunks: data.totalChunks || data.chunksIndexed,
        totalFiles: data.totalFiles || data.filesIndexed,
        totalEligibleFiles: data.totalEligibleFiles || null,
        remainingUnindexedFiles: data.remainingUnindexedFiles ?? null,
        isFullyIndexed: data.isFullyIndexed || false,
      });

      setCurrentRepo((prev) => ({
        ...prev,
        chunkCount: data.totalChunks || data.chunksIndexed,
        fileCount: data.totalFiles || data.filesIndexed,
      }));

      setLogs([
        {
          pass: 1,
          chunksAdded: data.chunksIndexed,
          filesAdded: data.filesIndexed,
          totalChunks: data.totalChunks || data.chunksIndexed,
          totalFiles: data.totalFiles || data.filesIndexed,
          totalEligible: data.totalEligibleFiles,
          isFullyIndexed: data.isFullyIndexed,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      setStatusMessage(`Fresh Pass 1 complete: ${data.chunksIndexed} chunks indexed across ${data.filesIndexed} files.`);
      if (onRepoUpdated) onRepoUpdated();
    } catch (err) {
      setError(err.message || "Failed clean re-index.");
    } finally {
      setCleanReindexing(false);
    }
  }

  const isComplete = stats.isFullyIndexed || (stats.remainingUnindexedFiles === 0 && stats.totalEligibleFiles !== null);
  const percentComplete = stats.totalEligibleFiles
    ? Math.min(100, Math.round((stats.totalFiles / stats.totalEligibleFiles) * 100))
    : stats.totalFiles > 0
    ? null
    : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--surface-raised)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "20px" }}>⚡</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>
                Progressive Deep Index Engine
              </h3>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {currentRepo.owner}/{currentRepo.name} &bull; Multi-Pass Serverless Indexing
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn" style={{ padding: "4px 8px", fontSize: "12px" }}>
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px", overflowY: "auto", maxHeight: "calc(90vh - 120px)" }}>
          {/* Status Gauge & Progress Card */}
          <div
            className="card"
            style={{
              padding: "16px",
              marginBottom: 20,
              background: isComplete ? "rgba(35, 134, 54, 0.08)" : "rgba(56, 139, 253, 0.08)",
              border: `1px solid ${isComplete ? "rgba(46, 160, 67, 0.35)" : "rgba(56, 139, 253, 0.35)"}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
                  Codebase Coverage
                </span>
                <div style={{ fontSize: "20px", fontWeight: 700, color: isComplete ? "var(--success)" : "var(--accent)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{stats.totalChunks.toLocaleString()} Indexed Chunks</span>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: isComplete ? "rgba(35, 134, 54, 0.2)" : "rgba(56, 139, 253, 0.2)",
                      border: `1px solid ${isComplete ? "rgba(46, 160, 67, 0.5)" : "rgba(56, 139, 253, 0.5)"}`,
                      fontWeight: 600,
                    }}
                  >
                    {isComplete ? "✓ 100% Vectorized" : percentComplete !== null ? `${percentComplete}% Covered` : "Micro-Batch Active"}
                  </span>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "13px", fontWeight: 600 }}>
                  {stats.totalFiles} {stats.totalEligibleFiles ? `/ ${stats.totalEligibleFiles}` : ""} files indexed
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {stats.remainingUnindexedFiles !== null
                    ? `${stats.remainingUnindexedFiles} files in queue`
                    : "Queue discovered on first pass"}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div
              style={{
                width: "100%",
                height: 8,
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: 4,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: `${percentComplete !== null ? Math.max(5, percentComplete) : 25}%`,
                  height: "100%",
                  background: isComplete ? "var(--success)" : "var(--accent)",
                  borderRadius: 4,
                  transition: "width 0.4s ease-in-out",
                }}
              />
            </div>
          </div>

          {/* Controls Strip */}
          <div
            className="card"
            style={{
              padding: "16px",
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: 2 }}>
                {isAutoRunning
                  ? "⚡ Auto-Indexing in Progress..."
                  : indexing
                  ? "Indexing Current Batch..."
                  : isComplete
                  ? "Repository 100% Indexed"
                  : "Ready for Next Pass"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                Each pass safely fetches and embeds ~80 files / ~350 chunks within 20s.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {isAutoRunning ? (
                <button
                  className="btn"
                  onClick={stopAutoDeepIndex}
                  style={{
                    fontSize: "12px",
                    padding: "6px 14px",
                    borderColor: "var(--danger)",
                    color: "var(--danger)",
                    background: "rgba(248, 81, 73, 0.1)",
                    fontWeight: 600,
                  }}
                >
                  ⏹ Stop Auto-Index
                </button>
              ) : (
                <>
                  {!isComplete && (
                    <button
                      className="btn"
                      onClick={() => executeBatch()}
                      disabled={indexing || cleanReindexing}
                      style={{ fontSize: "12px", padding: "6px 14px" }}
                      title="Run a single pass of ~80 files"
                    >
                      {indexing ? "Indexing..." : "Index Next Batch"}
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={startAutoDeepIndex}
                    disabled={indexing || cleanReindexing || isComplete}
                    style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
                    title="Automatically execute passes until all files are indexed"
                  >
                    <span>⚡</span>
                    <span>{isComplete ? "Fully Indexed" : "Auto Deep-Index All"}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Status Message / Error Banner */}
          {error && (
            <div
              className="card"
              style={{
                padding: "12px 16px",
                marginBottom: 16,
                background: "rgba(248, 81, 73, 0.1)",
                borderColor: "rgba(248, 81, 73, 0.4)",
                color: "var(--danger)",
                fontSize: "12px",
              }}
            >
              <strong>Error:</strong> {error}
            </div>
          )}

          {statusMessage && !error && (
            <div
              className="card"
              style={{
                padding: "10px 14px",
                marginBottom: 16,
                background: "var(--surface-raised)",
                fontSize: "12px",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>ℹ️</span>
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Live Progress Logs */}
          {logs.length > 0 && (
            <div className="card" style={{ padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 10 }}>
                Progressive Indexing Activity
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                {logs.map((log, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      fontFamily: "var(--font-mono)",
                      padding: "6px 10px",
                      background: "var(--surface-raised)",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--accent)", fontWeight: 700 }}>Pass #{log.pass}</span>
                      <span>+{log.chunksAdded} chunks ({log.filesAdded} files)</span>
                      {log.isFullyIndexed && (
                        <span style={{ color: "var(--success)", fontWeight: 600 }}>[100% COMPLETE]</span>
                      )}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "11px" }}>
                      Total: {log.totalChunks} chunks &bull; {log.timestamp}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Architectural Architecture Explainer */}
          <div className="card" style={{ padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: "14px" }}>💡</span>
              <strong style={{ fontSize: "13px" }}>Why Progressive Deep Index?</strong>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
              Vercel and serverless functions enforce a strict 60-second execution ceiling. Monolithic vector indexing on repositories with hundreds of source files triggers gateway timeouts. Progressive Deep Indexing streams ingestion through deterministic micro-batches of ~350 chunks (~80 files) each, ensuring 100% vector coverage across massive codebases without connection drops. Non-indexed files remain queryable through Just-In-Time (JIT) retrieval.
            </p>
          </div>

          {/* Reset / Fresh Indexing */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8 }}>
            <button
              onClick={handleCleanReindex}
              disabled={indexing || isAutoRunning || cleanReindexing}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--muted)",
                fontSize: "12px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
              title="Wipe existing chunks and re-index from file 1"
            >
              {cleanReindexing ? "Wiping & re-indexing..." : "Reset index & start fresh"}
            </button>

            {onOpenGroundingModal && (
              <button
                className="btn"
                onClick={() => {
                  onClose();
                  onOpenGroundingModal(currentRepo);
                }}
                style={{ fontSize: "12px", padding: "5px 12px" }}
              >
                Inspect Grounding Rate &rarr;
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", background: "var(--surface-raised)" }}>
          <button className="btn btn-primary" onClick={onClose} style={{ fontSize: "12px" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
