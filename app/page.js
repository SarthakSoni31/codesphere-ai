import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function Home() {
  const isSignedIn = Boolean(cookies().get("session_user_id"));
  if (isSignedIn) redirect("/dashboard");

  return (
    <div className="landing-container">
      {/* Hero Section */}
      <section className="hero-wrap">
        <div className="hero-pill">
          <span className="hero-pill-tag">UCS503P</span>
          <span className="hero-pill-sep">/</span>
          <span>Thapar Institute of Engineering &amp; Technology</span>
        </div>

        <h1 className="hero-heading">
          Codebase intelligence with <br />
          verified source grounding.
        </h1>

        <p className="hero-desc">
          CodeSphere connects directly to your GitHub repository to index source files into vector embeddings.
          Ask structural questions with file and line citations, triage new issues via webhook automation,
          and track module ownership across your team without duplicating data out of GitHub.
        </p>

        <div className="hero-actions">
          <a href="/api/auth/github" className="btn btn-primary hero-main-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            Sign in with GitHub
          </a>
          <a
            href="https://github.com/SarthakSoni31/codesphere-ai"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary hero-sec-btn"
          >
            Repository on GitHub
          </a>
        </div>

        {/* Realistic Technical Preview (Split Terminal / Code View) */}
        <div className="terminal-window">
          <div className="terminal-header">
            <div className="terminal-dots">
              <span className="t-dot" />
              <span className="t-dot" />
              <span className="t-dot" />
            </div>
            <div className="terminal-title">
              <span>SarthakSoni31/naayak</span>
              <span className="terminal-branch">main</span>
            </div>
            <div className="terminal-meta">pgvector: 384-dim (MiniLM-L6-v2)</div>
          </div>

          <div className="terminal-content">
            <div className="terminal-left">
              <div className="terminal-query">
                <span className="prompt-sym">$</span>
                <span className="query-text">codesphere query &quot;Where is authentication handled and guarded?&quot;</span>
              </div>
              <div className="terminal-response">
                <p>
                  Authentication is initialized with Passport in <code>config/passport.js</code> and mounted on <code>src/routes/auth.js</code>.
                  Protected routes are enforced by the middleware function <code>ensureAuthenticated</code> in <code>middleware/auth.js:36-43</code>.
                </p>
                <div className="code-snippet-box">
                  <div className="snippet-header">middleware/auth.js (lines 36-43)</div>
                  <pre><code>{`export function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.redirect('/auth/login?error=unauthorized');
}`}</code></pre>
                </div>
                <div className="citation-row">
                  <span className="citation-title">Sources cited:</span>
                  <span className="citation-badge">middleware/auth.js:36-43</span>
                  <span className="citation-badge">src/routes/auth.js:141-149</span>
                  <span className="citation-badge">config/passport.js:1-40</span>
                </div>
              </div>
            </div>

            <div className="terminal-right">
              <div className="system-panel">
                <div className="panel-row-header">Auto-Triage Webhook (issues.opened)</div>
                <div className="panel-body-text">
                  <span className="panel-k">Payload:</span> Issue #28 &quot;Cannot upload attachment&quot;<br />
                  <span className="panel-k">Status:</span> Verified via HMAC SHA-256<br />
                  <span className="panel-k">Action:</span> Posted comment &amp; labeled <code>bug</code><br />
                  <span className="panel-k">Latency:</span> 3.14s
                </div>
              </div>

              <div className="system-panel" style={{ marginTop: 12 }}>
                <div className="panel-row-header">Evaluation Target (Proposal Sec. 6.1)</div>
                <div className="panel-body-text">
                  <span className="panel-k">Primary Metric:</span> Answer Grounding Rate<br />
                  <span className="panel-k">Proposal Target:</span> &gt;= 85.0%<br />
                  <span className="panel-k">Measured Result:</span> <strong style={{ color: "var(--success)" }}>86.7% (13/15)</strong><br />
                  <span className="panel-k">Test Suite:</span> scripts/grounding-test.js
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Engineering Architecture Grid */}
      <section className="tech-section">
        <div className="tech-section-title">
          <span>System Capabilities</span>
          <h2>Designed for codebase understanding without overhead</h2>
        </div>

        <div className="tech-grid">
          <div className="tech-card">
            <div className="tech-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <h3>Grounded Retrieval (RAG)</h3>
            </div>
            <p>
              Splits codebases at syntax and function boundaries. Chunks are embedded locally using
              Xenova/all-MiniLM-L6-v2 without external API limits, and retrieved using pgvector cosine distance.
              Every generated answer cites specific lines or explicitly reports insufficient context.
            </p>
            <div className="tech-specs">
              <span>Local ONNX Runtime</span>
              <span>pgvector &lt;=&gt;</span>
              <span>Zero Hallucination Fallback</span>
            </div>
          </div>

          <div className="tech-card">
            <div className="tech-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <h3>GitHub Webhook Auto-Triage</h3>
            </div>
            <p>
              Subscribes to repository issue events with cryptographic HMAC signature verification.
              Automatically generates a one-sentence summary, assigns a classified label, and performs diagnostic
              retrieval to recommend source files to investigate.
            </p>
            <div className="tech-specs">
              <span>HMAC SHA-256</span>
              <span>Direct GitHub Commenting</span>
              <span>Automated File Pointers</span>
            </div>
          </div>

          <div className="tech-card">
            <div className="tech-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <h3>Logic &amp; Vulnerability Audit</h3>
            </div>
            <p>
              Performs on-demand heuristic reviews of indexed code chunks for logic errors, unhandled promise rejections,
              race conditions, and missing validation. Findings can be converted into GitHub issues with one click.
            </p>
            <div className="tech-specs">
              <span>Static Heuristics</span>
              <span>1-Click Issue Filing</span>
              <span>Non-Lintable Bug Detection</span>
            </div>
          </div>

          <div className="tech-card">
            <div className="tech-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <h3>Team Workspace &amp; Ownership</h3>
            </div>
            <p>
              Shared team repository view where any authenticated teammate can inspect indexed repos.
              Includes commit touch frequency for module ownership, lightweight file task delegation,
              and synchronized discussion channels.
            </p>
            <div className="tech-specs">
              <span>Module Ownership Heatmap</span>
              <span>Task Deadlines</span>
              <span>Live GitHub API Sync</span>
            </div>
          </div>
        </div>
      </section>

      {/* Evaluation Benchmark Block */}
      <section className="benchmark-section">
        <div className="benchmark-box">
          <div className="benchmark-header">
            <div>
              <span className="benchmark-tag">Evaluation Results</span>
              <h3>Proposal Grounding Metric Verification</h3>
              <p>Ran held-out question evaluation against <code>SarthakSoni31/naayak</code>.</p>
            </div>
            <div className="benchmark-score">
              <span className="score-val">86.7%</span>
              <span className="score-lbl">Target: &gt;= 85%</span>
            </div>
          </div>

          <div className="benchmark-terminal">
            <div className="t-row"><span className="t-pass">[PASS]</span> Where is authentication handled? &rarr; cited <code>middleware/auth.js:36-43</code>, <code>src/routes/auth.js:141-149</code></div>
            <div className="t-row"><span className="t-pass">[PASS]</span> How does GitHub OAuth login work? &rarr; cited <code>middleware/auth.js:36-43</code>, <code>app.js:71-96</code></div>
            <div className="t-row"><span className="t-pass">[PASS]</span> What fields does the grievance model have? &rarr; cited <code>models/grievance.js:36-74</code></div>
            <div className="t-row"><span className="t-pass">[PASS]</span> How does an official dashboard calculate assigned counts? &rarr; cited <code>src/routes/adhikari.js:1-40</code></div>
            <div className="t-summary">Grounding rate: 13/15 (86.7%) &bull; Full log: scripts/grounding-report.md</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-wrap">
          <div>
            <strong>CodeSphere AI</strong> &bull; UCS503P Project Proposal Implementation
            <div className="footer-sub">
              Thapar Institute of Engineering and Technology &bull; Sarthak Soni &amp; Ayush Bansal
            </div>
          </div>
          <div className="footer-links">
            <a href="https://github.com/SarthakSoni31/codesphere-ai" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <span>&bull;</span>
            <a href="/api/auth/github">Sign in</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
