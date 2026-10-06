import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function Home() {
  const isSignedIn = Boolean(cookies().get("session_user_id"));
  if (isSignedIn) redirect("/dashboard");

  return (
    <div className="landing-page">
      {/* Ambient background glow */}
      <div className="landing-glow" />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge">
          <span className="badge-pulse" />
          <span>v1.0 Live</span>
          <span className="badge-divider">•</span>
          <span>Thapar UCS503P Project</span>
          <span className="badge-divider">•</span>
          <span style={{ color: "var(--accent-strong)" }}>86.7% Grounded Accuracy</span>
        </div>

        <h1 className="hero-title">
          AI Codebase Intelligence <br />
          <span className="hero-title-gradient">&amp; Autonomous Team Triage</span>
        </h1>

        <p className="hero-subtitle">
          Connect your GitHub repository, query your code with zero hallucinations,
          auto-triage issues with an intelligent webhook bot, and coordinate module
          ownership with your team — all in one unified workspace.
        </p>

        <div className="hero-cta-group">
          <a href="/api/auth/github" className="btn btn-primary hero-btn-main">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            Sign in with GitHub
          </a>
          <a href="#features" className="btn hero-btn-secondary">
            Explore Capabilities ↓
          </a>
        </div>

        {/* Live Interactive Preview Card */}
        <div className="hero-preview-frame">
          <div className="preview-top-bar">
            <div className="preview-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <div className="preview-url-bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 6v6l4 2"/></svg>
              <span>codesphere.ai/dashboard — SarthakSoni31/naayak</span>
            </div>
            <div className="preview-status-pill">● pgvector ready</div>
          </div>

          <div className="preview-body">
            <div className="preview-chat-column">
              <div className="preview-user-bubble">
                <span className="bubble-label">Question:</span>
                Where is authentication handled and how are citizen grievances guarded?
              </div>
              <div className="preview-assistant-bubble">
                <div className="bubble-header">
                  <span className="ai-tag">CodeSphere Assistant</span>
                  <span className="grounding-tag">86.7% Grounding Match</span>
                </div>
                <p>
                  Authentication is handled in <code>config/passport.js</code> and mounted via <code>src/routes/auth.js</code>.
                  Citizen routes are guarded using session middleware in <code>middleware/auth.js:36-43</code>:
                </p>
                <div className="preview-code-block">
                  <span className="code-lang">JavaScript — middleware/auth.js:36</span>
                  <pre><code>{`export function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.redirect('/auth/login?error=unauthorized');
}`}</code></pre>
                </div>
                <div className="preview-sources-footer">
                  <span className="sources-label">Citations:</span>
                  <span className="citation-chip">middleware/auth.js:36-43</span>
                  <span className="citation-chip">src/routes/auth.js:141-149</span>
                  <span className="citation-chip">config/passport.js:1-40</span>
                </div>
              </div>
            </div>

            <div className="preview-side-column">
              <div className="mini-card-preview">
                <div className="mini-card-header">
                  <span className="icon-pulse">⚡</span>
                  <strong>Live Webhook Auto-Triage</strong>
                </div>
                <p className="mini-card-text">
                  New issue detected: <em>&quot;Cannot upload photo attachment on grievance&quot;</em>
                </p>
                <div className="mini-card-badge">
                  <span>Suggested Label: <code>bug</code></span>
                  <span className="tag-latency">Latency: 3.2s</span>
                </div>
                <div className="mini-card-code-pointer">
                  → Checked <code>helpers/uploader.js</code> (lines 12-45)
                </div>
              </div>

              <div className="mini-card-preview" style={{ marginTop: 12 }}>
                <div className="mini-card-header">
                  <span>🛡️</span>
                  <strong>AI Bug Scanner Findings</strong>
                </div>
                <div className="mini-card-finding">
                  <span className="badge-crit">Security</span>
                  <span>Missing CSRF token verification on POST /api/submit</span>
                </div>
                <button className="mini-btn-issue">+ File GitHub Issue (1-click)</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Ribbon */}
      <section className="metrics-ribbon">
        <div className="metric-box">
          <div className="metric-number">86.7%</div>
          <div className="metric-label">Answer Grounding Rate</div>
          <div className="metric-sub">Exceeds 85% proposal benchmark</div>
        </div>
        <div className="metric-divider" />
        <div className="metric-box">
          <div className="metric-number">&lt; 5s</div>
          <div className="metric-label">Webhook Triage Latency</div>
          <div className="metric-sub">Automated comments &amp; label prediction</div>
        </div>
        <div className="metric-divider" />
        <div className="metric-box">
          <div className="metric-number">$0</div>
          <div className="metric-label">Embedding Cost</div>
          <div className="metric-sub">Local MiniLM-L6-v2 ONNX runtime</div>
        </div>
        <div className="metric-divider" />
        <div className="metric-box">
          <div className="metric-number">30+</div>
          <div className="metric-label">Supported Languages</div>
          <div className="metric-sub">JS, TS, Python, Go, Rust, Java, Docker</div>
        </div>
      </section>

      {/* Feature Bento Grid */}
      <section id="features" className="features-section">
        <div className="section-header">
          <span className="section-eyebrow">Enterprise-Grade Features</span>
          <h2 className="section-title">Built specifically for high-velocity software teams</h2>
          <p className="section-description">
            Everything you need to eliminate onboarding friction, prevent code review blindness,
            and maintain continuous backlog health without leaving your GitHub workflow.
          </p>
        </div>

        <div className="bento-grid">
          {/* Card 1 */}
          <div className="bento-card bento-span-2">
            <div className="bento-icon">🔍</div>
            <div className="bento-content">
              <h3>Strictly Grounded RAG Code Assistant</h3>
              <p>
                Ask deep architecture questions, pinpoint where complex logic resides, and trace dependencies.
                Powered by PostgreSQL <code>pgvector</code> cosine search, answers cite file paths and exact
                line numbers — with zero hallucinations. If context is missing, it refuses to guess.
              </p>
              <div className="bento-tags">
                <span className="feature-pill">Xenova MiniLM-L6-v2</span>
                <span className="feature-pill">pgvector &lt;=&gt;</span>
                <span className="feature-pill">Gemini Flash-Lite</span>
                <span className="feature-pill">Line-level citations</span>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bento-card">
            <div className="bento-icon">🤖</div>
            <div className="bento-content">
              <h3>Autonomous Issue Webhook Bot</h3>
              <p>
                On every new GitHub issue, the webhook bot uses cryptographic HMAC verification,
                summarizes the issue, predicts its label, and points developers to the exact source files to check.
              </p>
              <div className="bento-tags">
                <span className="feature-pill">HMAC SHA-256</span>
                <span className="feature-pill">Auto-labeling</span>
                <span className="feature-pill">Code Pointers</span>
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bento-card">
            <div className="bento-icon">🛡️</div>
            <div className="bento-content">
              <h3>AI Bug &amp; Logic Scanner</h3>
              <p>
                Static linters only catch syntax. CodeSphere analyzes logic errors, unhandled race conditions,
                and security holes across your indexed AST — with 1-click filing straight to GitHub.
              </p>
              <div className="bento-tags">
                <span className="feature-pill">Logic Review</span>
                <span className="feature-pill">Security Auditing</span>
                <span className="feature-pill">1-Click GitHub Issues</span>
              </div>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bento-card bento-span-2">
            <div className="bento-icon">📊</div>
            <div className="bento-content">
              <h3>Live Backlog Health &amp; Module Ownership</h3>
              <p>
                No duplicated databases. CodeSphere pulls open issues, PR counts, and commit velocity live
                from GitHub&apos;s REST API. Module ownership heatmaps show who frequently modifies which files
                so you never wonder who owns what.
              </p>
              <div className="bento-tags">
                <span className="feature-pill">Real-time GitHub Sync</span>
                <span className="feature-pill">Staleness Detection</span>
                <span className="feature-pill">Author Heatmap</span>
              </div>
            </div>
          </div>

          {/* Card 5 */}
          <div className="bento-card">
            <div className="bento-icon">👥</div>
            <div className="bento-content">
              <h3>Task Delegation &amp; Deadlines</h3>
              <p>
                Assign critical modules to teammates with notes, deadlines, and read receipts.
                Keep tasks linked to actual code instead of bloated external task boards.
              </p>
              <div className="bento-tags">
                <span className="feature-pill">File Ownership</span>
                <span className="feature-pill">Due Dates</span>
                <span className="feature-pill">Read Receipts</span>
              </div>
            </div>
          </div>

          {/* Card 6 */}
          <div className="bento-card">
            <div className="bento-icon">💬</div>
            <div className="bento-content">
              <h3>Shared Team Discussions</h3>
              <p>
                Synchronized human-to-human discussion channels per repository. Discuss pull requests,
                architecture designs, and bug findings in one centralized place.
              </p>
              <div className="bento-tags">
                <span className="feature-pill">Persistent Chat</span>
                <span className="feature-pill">Multi-user Sync</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="workflow-section">
        <div className="section-header">
          <span className="section-eyebrow">Zero Configuration</span>
          <h2 className="section-title">How CodeSphere AI Works</h2>
        </div>

        <div className="workflow-steps">
          <div className="step-card">
            <div className="step-number">01</div>
            <h4>Connect via GitHub</h4>
            <p>Authenticate with one-click GitHub OAuth. Any teammate can view any connected team repository.</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card">
            <div className="step-number">02</div>
            <h4>Index Ingestion</h4>
            <p>CodeSphere crawls your repo tree, chunks functions &amp; classes, and computes 384-dim vectors locally.</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card">
            <div className="step-number">03</div>
            <h4>Ask &amp; Automate</h4>
            <p>Ask grounded questions, run on-demand bug audits, and receive instant auto-triage on GitHub issues.</p>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="cta-banner">
        <h2>Ready to supercharge your codebase workflow?</h2>
        <p>Get started in less than 60 seconds with your GitHub account.</p>
        <a href="/api/auth/github" className="btn btn-primary cta-btn">
          Connect Your First Repository →
        </a>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div>
            <strong>CodeSphere AI</strong> — UCS503P Capstone Project
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.82rem" }}>
              Thapar Institute of Engineering and Technology • Sarthak Soni &amp; Ayush Bansal
            </p>
          </div>
          <div className="footer-links">
            <a href="https://github.com/SarthakSoni31/codesphere-ai" target="_blank" rel="noreferrer">
              GitHub Repository
            </a>
            <span style={{ color: "var(--border)" }}>•</span>
            <span style={{ color: "var(--muted)" }}>CI Passing (Green)</span>
            <span style={{ color: "var(--border)" }}>•</span>
            <span style={{ color: "var(--accent)" }}>86.7% Grounding Rate</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
