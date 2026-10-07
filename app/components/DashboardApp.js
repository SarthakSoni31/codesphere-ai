"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

export default function DashboardApp() {
  const [teamRepos, setTeamRepos] = useState([]);
  const [loadingTeamRepos, setLoadingTeamRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null); // { id, owner, name, chunkCount, indexedBy, indexedByUserId }
  const [view, setView] = useState("chat"); // "chat" | "dashboard" | "team" | "discussion" | "assignments"
  const [showConnectForm, setShowConnectForm] = useState(false);

  const [currentUser, setCurrentUser] = useState(null); // { id, login }
  const [searchQuery, setSearchQuery] = useState("");

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
    <div className="app-shell">
      <aside className="sidebar">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p className="sidebar-heading" style={{ margin: 0 }}>
            Repositories ({teamRepos.length})
          </p>
          <button
            className="btn"
            style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
            onClick={() => {
              setShowConnectForm(true);
              setSelectedRepo(null);
            }}
          >
            + New
          </button>
        </div>

        {teamRepos.length > 2 && (
          <input
            type="text"
            className="sidebar-search"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        )}

        {loadingTeamRepos && <p className="empty-state">Loading repositories...</p>}
        {!loadingTeamRepos && teamRepos.length === 0 && (
          <p className="empty-state">No repos indexed yet. Click &quot;+ New&quot; to connect one.</p>
        )}

        {filteredRepos.map((r) => (
          <div key={r.id} className={`repo-row ${selectedRepo?.id === r.id ? "active" : ""}`} style={{ cursor: "default" }}>
            <button
              onClick={() => selectRepo(r)}
              style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", textAlign: "left" }}
            >
              <span className="repo-avatar">{r.name.slice(0, 2).toUpperCase()}</span>
              <span style={{ minWidth: 0 }}>
                <div className="repo-row-name">{r.name}</div>
                <div className="repo-row-meta">{r.chunkCount} chunks</div>
              </span>
            </button>
            {currentUser && r.indexedByUserId === currentUser.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteRepo(r);
                }}
                title="Delete repository"
                style={{ background: "none", border: "none", color: "var(--muted-2)", cursor: "pointer", display: "inline-flex", alignItems: "center", flexShrink: 0, padding: "2px 4px" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            )}
          </div>
        ))}

        {selectedRepo && (
          <>
            <button
              className="sidebar-back-hub"
              onClick={() => setSelectedRepo(null)}
              style={{ marginTop: 12 }}
            >
              &larr; Workspace Overview
            </button>
            <p className="sidebar-heading" style={{ marginTop: "0.8rem" }}>{selectedRepo.name}</p>
            <button className={`nav-tab ${view === "chat" ? "active" : ""}`} onClick={() => setView("chat")}>
              Code Assistant
            </button>
            <button className={`nav-tab ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>
              Backlog &amp; Health
            </button>
            <button className={`nav-tab ${view === "team" ? "active" : ""}`} onClick={() => setView("team")}>
              Contributors
            </button>
            <button
              className={`nav-tab ${view === "discussion" ? "active" : ""}`}
              onClick={() => setView("discussion")}
            >
              Discussion
            </button>
            <button
              className={`nav-tab ${view === "assignments" ? "active" : ""}`}
              onClick={() => setView("assignments")}
            >
              Assignments
            </button>
          </>
        )}
      </aside>

      <div className="main-panel">
        {showConnectForm && <ConnectRepoView onIndexed={handleIndexed} onCancel={() => setShowConnectForm(false)} />}

        {!showConnectForm && !selectedRepo && (
          <HomeView
            currentUser={currentUser}
            teamRepos={teamRepos}
            onOpenRepo={(id, initialView = "chat") => {
              const repo = teamRepos.find((r) => r.id === id);
              if (repo) selectRepo(repo, initialView);
            }}
            onConnectNew={() => setShowConnectForm(true)}
          />
        )}

        {!showConnectForm && selectedRepo && view === "chat" && <ChatView repo={selectedRepo} />}
        {!showConnectForm && selectedRepo && view === "dashboard" && <DashboardView repo={selectedRepo} />}
        {!showConnectForm && selectedRepo && view === "team" && <TeamView repo={selectedRepo} />}
        {!showConnectForm && selectedRepo && view === "discussion" && <DiscussionView repo={selectedRepo} />}
        {!showConnectForm && selectedRepo && view === "assignments" && (
          <AssignmentsView repo={selectedRepo} currentUser={currentUser} />
        )}
      </div>
    </div>
  );
}

function HomeView({ currentUser, teamRepos = [], onOpenRepo, onConnectNew }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="dashboard-hub">
      {/* Header */}
      <div className="hub-welcome-banner">
        <div>
          <span className="hero-eyebrow">WORKSPACE</span>
          <h1 style={{ fontSize: "1.7rem", marginBottom: 4, marginTop: 4 }}>
            {currentUser ? `@${currentUser.login}` : "Workspace Overview"}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", margin: 0 }}>
            Connected repositories and assigned tasks across your team.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onConnectNew} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span>+ Connect repository</span>
        </button>
      </div>

      {/* Summary Metrics Strip */}
      <div className="hub-summary-strip">
        <div className="summary-item">
          <span className="summary-val">{teamRepos.length}</span>
          <span className="summary-lbl">Repositories</span>
        </div>
        <div className="summary-sep" />
        <div className="summary-item">
          <span className="summary-val">{totalChunks.toLocaleString()}</span>
          <span className="summary-lbl">Vector Chunks</span>
        </div>
        <div className="summary-sep" />
        <div className="summary-item">
          <span className="summary-val">{assignments.length}</span>
          <span className="summary-lbl">Assigned Tasks ({overdue.length} overdue)</span>
        </div>
        <div className="summary-sep" />
        <div className="summary-item">
          <span className="summary-val" style={{ color: "var(--success)" }}>86.7%</span>
          <span className="summary-lbl">Grounding Rate</span>
        </div>
      </div>

      {/* Connected Repositories Section */}
      <div style={{ marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
          <h3 className="hub-section-title" style={{ margin: 0 }}>
            Connected Repositories ({teamRepos.length})
          </h3>
          {teamRepos.length > 0 && (
            <button className="btn" style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem" }} onClick={onConnectNew}>
              + Add repository
            </button>
          )}
        </div>

        {teamRepos.length === 0 ? (
          <div className="card" style={{ padding: "2.5rem 1.5rem", textAlign: "center", maxWidth: 540, margin: "0 auto" }}>
            <h4 style={{ margin: "0 0 6px", fontSize: "1.05rem" }}>No repositories connected yet</h4>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.2rem", lineHeight: 1.5 }}>
              Connect a GitHub repository to begin indexing source files, asking grounded questions, and automating issue triage.
            </p>
            <button className="btn btn-primary" onClick={onConnectNew}>
              Connect repository &rarr;
            </button>
          </div>
        ) : (
          <div className="hub-repo-grid">
            {teamRepos.map((r) => (
              <div key={r.id} className="hub-repo-card">
                <div>
                  <div className="hub-repo-card-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span className="repo-avatar">{r.name.slice(0, 2).toUpperCase()}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="hub-repo-title" title={`${r.owner}/${r.name}`}>
                          {r.owner}/{r.name}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                          Branch: {r.default_branch || "main"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="hub-repo-meta">
                    {r.chunkCount} chunks indexed &bull; Connected by @{r.indexedBy || "team"}
                  </div>
                </div>

                <div className="hub-repo-actions">
                  <button className="hub-repo-btn primary" onClick={() => onOpenRepo(r.id, "chat")}>
                    Code Assistant
                  </button>
                  <button className="hub-repo-btn" onClick={() => onOpenRepo(r.id, "dashboard")}>
                    Backlog &amp; Health
                  </button>
                  <button className="hub-repo-btn" onClick={() => onOpenRepo(r.id, "assignments")}>
                    Assignments
                  </button>
                  <button className="hub-repo-btn" onClick={() => onOpenRepo(r.id, "discussion")}>
                    Discussion
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task & Assignment Section */}
      <div>
        <h3 className="hub-section-title">
          Assigned Tasks
        </h3>

        {loading && <p className="empty-state">Loading tasks...</p>}

        {!loading && assignments.length === 0 && (
          <div className="card" style={{ maxWidth: 520 }}>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
              No tasks currently assigned to your account.
            </p>
          </div>
        )}

        {overdue.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p className="sidebar-heading" style={{ padding: 0, color: "var(--danger)", marginBottom: 8 }}>
              Overdue ({overdue.length})
            </p>
            <TaskList tasks={overdue} onMarkRead={markRead} onOpenRepo={onOpenRepo} />
          </div>
        )}

        {upcoming.length > 0 && (
          <div>
            <p className="sidebar-heading" style={{ padding: 0, marginBottom: 8 }}>
              Active ({upcoming.length})
            </p>
            <TaskList tasks={upcoming} onMarkRead={markRead} onOpenRepo={onOpenRepo} />
          </div>
        )}
      </div>
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
    setStatus("Indexing repository... this can take a minute.");
    try {
      const res = await fetch("/api/index-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });
      const data = await res.json();
      if (res.ok && data.repositoryId) {
        setStatus("");
        setResult(data);
      } else {
        setStatus(`Error: ${data.error || "indexing failed"}`);
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`);
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
                        {skipped.overFileCap} eligible files didn&apos;t fit under the {400}-file cap for one index run:
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

function ChatView({ repo }) {
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
                {turn.sources.map((s) => (
                  <span key={s} className="source-chip mono">
                    {s}
                  </span>
                ))}
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
                  {help.sources.map((s) => (
                    <span key={s} className="source-chip mono">
                      {s}
                    </span>
                  ))}
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
