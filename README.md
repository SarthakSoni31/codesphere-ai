# CodeSphere AI

An open-source codebase intelligence and repository automation platform: connect GitHub repositories, perform grounded code Q&A with exact line citations, execute progressive multi-pass deep indexing without serverless timeouts, benchmark factual grounding reliability (≥85.0% threshold), auto-triage incoming issues via HMAC webhooks, scan codebases for memory leaks, and generate pull requests directly from the browser.

Built with retrieval over indexed source (not model fine-tuning), local ONNX vector embeddings, PostgreSQL `pgvector`, and GitHub OAuth — with zero data duplicated out of GitHub.

---

## Architecture & System Overview

```
┌────────────────────────────────┐       OAuth       ┌────────────────────────────────────────┐
│     Next.js Web Workspace      │ ◄───────────────► │          GitHub REST API & Git         │
│ (Chat, Issues, PRs, Ownership) │                   │  (Tree, Files, Commits, Pull Requests) │
└───────────────┬────────────────┘                   └───────────────────┬────────────────────┘
                │                                                        │
                ├───────────────────────┬────────────────────────────────┤
                ▼                       ▼                                ▼
       Postgres + pgvector     Local ONNX Embeddings             GitHub Webhook Bot
     (Chunks, Users, Repos,    (all-MiniLM-L6-v2 ONNX,        (issues.opened HMAC SHA-256
      Discussions, Tasks)      runs offline, zero cost)         Auto-triage & diagnostics)
                │                       ▲
                ▼                       │
    Gemini 1.5 Grounded LLM ────────────┘
  (Exact file:line source citations,
   Strict zero-hallucination fallback)
```

### 1. Grounded Codebase Retrieval (RAG)
- **Local ONNX Embeddings**: Employs `@xenova/transformers` with `all-MiniLM-L6-v2` generating 384-dimensional dense vectors locally. Embeddings run offline with `/tmp` cache optimization on serverless runtimes (Vercel Lambda).
- **AST Function & Class Boundary Chunking**: Segments source code at function, class, and export boundaries with fallback line-window slicing for configs and markdown.
- **Just-In-Time (JIT) Fallback**: If an unindexed file is referenced or vector recall needs expansion, CodeSphere fetches and chunks targeted files dynamically via GitHub API on demand.
- **Clickable Line Citations**: Every answer and issue solution cites exact files and line ranges (e.g., `middleware/auth.js:36-43`), hyperlinked directly to GitHub line anchors (`#L36-L43`).

### 2. Multi-Pass Progressive Deep Indexing
- Serverless platforms enforce strict 60-second execution ceilings. Monolithic ingestion of large codebases (>1,000 chunks) causes gateway timeouts.
- **Micro-Batch Delta Slicing**: Deep Indexing streams ingestion in deterministic passes of ~80 files / ~350 chunks (~20s per pass).
- **Intelligent Deduplication**: Queries `SELECT DISTINCT file_path FROM chunks WHERE repository_id = $1` to vectorize only unindexed files, preserving existing embeddings.
- **Interactive UI Engine**: Features single-pass execution, automated looping with a 1.5s interval, live progress metrics, and an active pause/stop controller.

### 3. Grounding Reliability Verification (≥85.0% Target Standard)
- **Automated In-Code Benchmark**: Executes a 20-probe architectural test suite sampling diverse modules, entrypoints, and controllers across the repository.
- **Threshold Enforcement**: Mandates ≥85.0% source grounding accuracy. Repositories below threshold display actionable alerts and a 4-step optimization guide.
- **Exportable Audit Report**: Export and copy complete markdown verification reports detailing exact probe outcomes and cited lines.

### 4. Backlog Health, Bug Scanning & Automated PR Delivery
- **Memory Leak & Bug Scanner**: Scans repository code and issues for unclosed streams, missing error handlers, hanging intervals, and circular references.
- **AI Solution Formulation**: Formulates concrete code fixes grounded in actual files.
- **One-Click GitHub Delivery**:
  - Direct branch push & Pull Request creation if the user has write access.
  - Automatic fork detection & fork-branch Pull Request delivery if repository access is read-only.
  - Comment delivery to existing GitHub issues.

### 5. Shared Team Workspace & Module Ownership
- **Shared Repository Pool**: Repositories indexed by any team member are instantly accessible across the workspace.
- **Commit Touch Frequency Heatmap**: Calculates 30-day commit attribution per module to highlight subject matter experts and code owners.
- **Task Delegation & Deadlines**: Assign individual files to teammates with date deadlines and overdue tracking.
- **Synchronized Discussion Channels**: In-repo team discussions synchronized across teammates.

---

## Project Structure

```
app/
  page.js                       Landing page with live architecture preview
  layout.js                     Global GitHub dark theme layout
  dashboard/page.js             Auth-gated workspace wrapper
  components/DashboardApp.js    Client application (Copilot, Issues, PRs, Ownership, Deep Index)
  api/
    auth/github/route.js        GitHub OAuth initiation
    auth/callback/route.js      GitHub OAuth token exchange & session setup
    auth/logout/route.js        Session clearance
    me/route.js                 Current authenticated user profile
    repositories/route.js       Lists indexed team repositories with chunk/file counts
    repositories/[id]/route.js  Delete repository & cascading chunks
    repositories/[id]/probe/    20-probe automated grounding health benchmark
    index-repo/route.js         Progressive Deep Index & vector ingestion engine
    chat/route.js               Grounded Copilot Q&A with cosine search
    chat-history/route.js       PostgreSQL chat history persistence
    dashboard/route.js          Live issue health & commit ownership statistics
    scan/route.js               Static heuristic scan for leaks & bug patterns
    issue-help/route.js         Diagnostic assistance for specific issues
    generate-solution/route.js  Formulates actionable code diffs/solutions
    create-pr/route.js          Automated fork/branch creation and Pull Request opener
    post-issue-solution/route.js Posts solutions as issue comments
    assignments/route.js        Task assignment and management per file
    my-assignments/route.js     User-specific task queue & deadline tracker
    messages/route.js           Team discussion channel messages
    webhooks/github/route.js    HMAC-verified issue auto-triage bot
lib/
  db.js                         PostgreSQL connection pool & session utilities
  github.js                     GitHub REST API client (tree, contents, PRs, forks)
  chunk.js                      Boundary & window code splitter
  embeddings.js                 Local ONNX runtime embeddings (all-MiniLM-L6-v2)
  retrieval.js                  pgvector cosine search + JIT on-demand retrieval
  llm.js                        Google Gemini 1.5 client with zero-hallucination guard
  heatmap.js                    Commit attribution and ownership calculations
db/
  schema.sql                    Database schema: users, repositories, chunks, qa_history, tasks
  migrate.js                    Database migration runner
```

---

## Prerequisites

1. **Node.js**: Version 18 or higher.
2. **PostgreSQL with `pgvector`**:
   - [Supabase](https://supabase.com) (Recommended, free tier includes `pgvector`)
   - [Neon](https://neon.tech)
   - Or local PostgreSQL with `CREATE EXTENSION IF NOT EXISTS vector;`
3. **GitHub OAuth App**:
   - Create at `GitHub → Settings → Developer settings → OAuth Apps → New OAuth App`
   - Homepage URL: `http://localhost:3000` (or your production domain)
   - Callback URL: `http://localhost:3000/api/auth/callback`
4. **Google Gemini API Key**:
   - Get a free key at [Google AI Studio](https://aistudio.google.com/apikey).
   - Used for grounded reasoning and issue triage. Embeddings run completely offline locally without API keys.

---

## Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Application Host
NEXT_PUBLIC_APP_URL=http://localhost:3000

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# GitHub Webhook Secret (for auto-triage bot)
GITHUB_WEBHOOK_SECRET=your_random_webhook_secret

# Database (PostgreSQL + pgvector)
DATABASE_URL=postgres://user:password@host:5432/database
DATABASE_SSL=true

# Google Gemini (Reasoning & Triage)
GOOGLE_API_KEY=your_gemini_api_key
```

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run migrations
npm run db:migrate

# 3. Start local development server
npm run dev
```

Visit `http://localhost:3000` and sign in with GitHub.

---

## Deployment (Vercel)

1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. Set the environment variables in **Project Settings → Environment Variables**.
4. Update your GitHub OAuth App's Homepage and Authorization Callback URLs to your production domain.
5. Deploy.

---

## License

MIT License. Designed for engineering teams and open source contributors.
