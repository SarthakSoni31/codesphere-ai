# CodeSphere AI

An AI-assisted codebase understanding tool: connect a GitHub repo, ask questions
grounded in the actual source code (with file/line citations), auto-triage new
issues with a webhook bot, and see a live backlog-health dashboard.

This implements the architecture from the project proposal (`codesphere-ai-proposal.pdf`):
retrieval over indexed source (not model training), a GitHub OAuth-connected
website, and a webhook-driven auto-triage bot — no data duplicated out of GitHub.

**This is a shared team workspace, not a per-person tool.** Any teammate can
sign in with their own GitHub account and see every repo the team has
indexed (`GET /api/repositories`), then chat about any of them — they don't
need to index it themselves. Whoever most recently indexed a repo becomes
its "connector" (their GitHub token is what the auto-triage bot uses to post
comments on that repo), but querying and chatting is open to the whole team.

## How it works

```
┌─────────────┐   OAuth login    ┌──────────────────────────┐
│   Browser   │ ───────────────► │  Next.js app (this repo)  │
│  (Dashboard)│ ◄─────────────── │  frontend + API routes    │
└─────────────┘   chat / index   └────────────┬─────────────┘
                                               │
                     ┌─────────────────────────┼─────────────────────────┐
                     ▼                         ▼                         ▼
              GitHub REST API          Postgres + pgvector          Local embeddings +
        (tree, files, issues,        (users, repos, chunks,           Google Gemini
         commits, comments)           embeddings, summaries)   (embeddings run locally,
                     ▲                                          no API/cost/rate limit;
                     │                                        Gemini for answers/triage)
        GitHub webhook ("issue opened") ──► /api/webhooks/github ──► auto-comment
```

**Indexing** (`POST /api/index-repo`): walks the repo's file tree, chunks each
file (by function/class boundary when recognizable, else fixed-size windows),
embeds every chunk **locally** using `Xenova/all-MiniLM-L6-v2` (runs on your
own machine via transformers.js — no API key, no cost, no rate limit), and
stores the vectors in Postgres via pgvector.

**Chat** (`POST /api/chat`): embeds the question the same way, retrieves the
nearest chunks with pgvector's cosine-distance operator (`<=>`), and asks
Gemini to answer using only those chunks — citing file paths, refusing to
guess if retrieval comes back empty.

**Dashboard** (`GET /api/dashboard`): pulls open issues and recent commits
live from the GitHub API on every request (issues/PRs are never duplicated
into our own database) and computes staleness + module ownership.

**Auto-triage bot** (`POST /api/webhooks/github`): GitHub calls this URL when
an issue opens; it verifies the webhook signature, asks Gemini for a one-line
summary + label, and posts both back to GitHub as a comment.

## Project structure

```
app/
  page.js                    Landing / sign-in page
  layout.js                  Shared header, dark theme
  dashboard/page.js          Auth-gated wrapper for the dashboard
  components/DashboardApp.js Client UI: connect+index, chat, backlog dashboard
  components/SignOutButton.js
  api/
    auth/github/route.js       Step 1: redirect to GitHub OAuth
    auth/callback/route.js     Step 2: exchange code, create session
    auth/logout/route.js
    repositories/route.js       Lists every repo the team has indexed
    index-repo/route.js        Chunk + embed a repo into Postgres
    chat/route.js               Retrieval-augmented Q&A (any teammate, any indexed repo)
    dashboard/route.js          Live issues/commits from GitHub
    webhooks/github/route.js    Auto-triage bot
lib/
  db.js            Postgres pool + session lookup
  github.js        All GitHub REST API calls
  chunk.js         File -> chunk splitting
  embeddings.js    Local embeddings (Xenova/all-MiniLM-L6-v2, no API needed)
  llm.js           Gemini calls (chat answers, issue summaries)
db/
  schema.sql       Tables: users, repositories, chunks, issue_summaries
  migrate.js       Applies schema.sql to DATABASE_URL
```

## Prerequisites

- Node.js 18+
- A Postgres database with the [pgvector](https://github.com/pgvector/pgvector) extension available
  (any of these work: [Supabase](https://supabase.com) free tier, [Neon](https://neon.tech) free tier,
  or a local Postgres with `CREATE EXTENSION vector;` enabled)
- A GitHub account you can create an OAuth App under
- A [Google Gemini API key](https://aistudio.google.com/apikey) (free tier available; used only for chat answers and issue triage — embeddings run locally on your machine, no key or quota needed for those)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a GitHub OAuth App

GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/callback`

Copy the generated **Client ID** and **Client secret**.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for local dev
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — from step 2
- `GITHUB_WEBHOOK_SECRET` — any random string you make up now (used in step 6)
- `DATABASE_URL` — your Postgres connection string
- `DATABASE_SSL` — `true` if your provider requires SSL (Supabase/Neon do)
- `GOOGLE_API_KEY` — from aistudio.google.com/apikey above (used for chat/triage only)

### 4. Create the database tables

```bash
export $(grep -v '^#' .env.local | xargs) && npm run db:migrate
```

This runs `db/schema.sql`, which also enables the `vector` extension.

### 5. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`, click **Sign in with GitHub**, then on the
dashboard enter an `owner`/`repo` (e.g. `octocat` / `Hello-World`) and click
**Index**. Once indexing finishes, ask questions in the chat box.

> **First index will be slower.** The very first time you index a repo, the
> app downloads the local embedding model (~90MB, one-time, cached to disk
> afterward) — this can take 30–60 seconds before indexing itself even
> starts. Every run after that is fast, fully offline, and free.

> The OAuth scope requested is `repo`, so this works for private repos too —
> just make sure the signed-in GitHub account has access to whatever repo you index.

### 6. (Optional) Wire up the auto-triage bot

The bot listens for GitHub's `issues` webhook. On the repo you indexed:

GitHub → repo → Settings → Webhooks → **Add webhook**

- Payload URL: `{NEXT_PUBLIC_APP_URL}/api/webhooks/github` — for local dev,
  expose your server first with something like `ngrok http 3000` and use the
  `https://...ngrok...` URL
- Content type: `application/json`
- Secret: the same value as `GITHUB_WEBHOOK_SECRET` in `.env.local`
- Which events: select **Issues** only

Open a new issue on that repo — within a few seconds you should see a comment
from your bot with a summary and a suggested label.

## Deploying

- **App**: any Node host that supports Next.js (Vercel is the path of least
  resistance — set the same environment variables in the project settings,
  and update `NEXT_PUBLIC_APP_URL` and the OAuth App's callback URL to your
  production domain).
- **Database**: Supabase or Neon both give you Postgres + pgvector without
  managing a server yourself.
- **CI/CD**: add a workflow that runs `npm run build` and your test suite on
  every push, then deploys to staging — see proposal section 5.3.

## Notes on scope

This is the first-iteration deliverable from the proposal (section 9.1):
OAuth login, single-repo indexing, grounded chat, and the auto-triage bot,
with CI/CD-friendly structure. Deliberately **not** built yet (see 9.2):
incremental re-indexing on new commits (current indexing always does a full
re-index), multi-repo/multi-team support, and a full GitHub App installation
flow (the webhook here is a simpler per-repo webhook using the connecting
user's OAuth token, which covers the same auto-triage feature without the
added complexity of GitHub App private keys and installation tokens — a
natural upgrade path once multi-team support is needed).
