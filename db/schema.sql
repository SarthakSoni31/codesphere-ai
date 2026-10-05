-- CodeSphere AI database schema
-- Requires the pgvector extension (https://github.com/pgvector/pgvector)

create extension if not exists vector;

-- One row per GitHub-authenticated user.
create table if not exists users (
  id             serial primary key,
  github_id      bigint unique not null,
  github_login   text not null,
  access_token   text not null,        -- OAuth token, used for API calls + posting comments
  created_at     timestamptz not null default now()
);

-- One row per repository a user has connected.
create table if not exists repositories (
  id              serial primary key,
  owner           text not null,
  name            text not null,
  user_id         integer not null references users(id) on delete cascade,
  default_branch  text,
  last_commit_sha text,               -- used later for incremental re-indexing
  indexed_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (owner, name)
);

-- One row per indexed code chunk, with its embedding for retrieval.
-- 384 matches Xenova/all-MiniLM-L6-v2 (see lib/embeddings.js); change if you
-- swap to a different local or hosted embedding model.
create table if not exists chunks (
  id             serial primary key,
  repository_id  integer not null references repositories(id) on delete cascade,
  file_path      text not null,
  start_line     integer not null,
  end_line       integer not null,
  content        text not null,
  embedding      vector(384) not null,
  created_at     timestamptz not null default now()
);

create index if not exists chunks_repository_id_idx on chunks (repository_id);

-- NOTE: we deliberately do NOT create an ivfflat/hnsw index on `embedding`.
-- Those approximate-search indexes must be built AFTER real data exists —
-- building one on an empty table (as happens here, since this migration
-- runs before any repo is indexed) produces a permanently degenerate index
-- that silently returns zero rows for similarity search, with no error.
-- At this project's scale (hundreds of chunks per repo) a plain sequential
-- scan for `ORDER BY embedding <=> ...` is fast enough that no index is
-- needed. If you outgrow that, create the index manually AFTER chunks are
-- populated: CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = <rows/1000, minimum 10>); then re-run ANALYZE chunks;

-- One row per issue the auto-triage bot has commented on (avoids duplicate comments).
create table if not exists issue_summaries (
  id               serial primary key,
  repository_id    integer not null references repositories(id) on delete cascade,
  issue_number     integer not null,
  summary          text,
  suggested_label  text,
  created_at       timestamptz not null default now(),
  unique (repository_id, issue_number)
);

-- Shared team discussion per repo — real human-to-human chat about the code,
-- separate from the private per-browser AI Q&A in `chat`. Visible to every
-- teammate who has the repo selected.
create table if not exists repo_messages (
  id             serial primary key,
  repository_id  integer not null references repositories(id) on delete cascade,
  user_id        integer not null references users(id) on delete cascade,
  message        text not null,
  created_at     timestamptz not null default now()
);
create index if not exists repo_messages_repository_id_idx on repo_messages (repository_id);

-- Who's working on which file/module for a repo. Deliberately NOT a full
-- Kanban/task board (the proposal explicitly says GitHub Projects already
-- covers that) — just a lightweight "this part is assigned to that person"
-- marker the whole team can see, one row per file per repo. Only the repo's
-- admin (whoever connected/indexed it — see repositories.user_id) can create
-- or change assignments; everyone else can see them, including who assigned
-- it and by when.
create table if not exists assignments (
  id             serial primary key,
  repository_id  integer not null references repositories(id) on delete cascade,
  file_path      text not null,
  assigned_to    integer not null references users(id) on delete cascade,
  assigned_by    integer references users(id) on delete set null,
  note           text,
  deadline       date,
  read_at        timestamptz,
  updated_at     timestamptz not null default now(),
  unique (repository_id, file_path)
);

-- ALTER ... ADD COLUMN IF NOT EXISTS is idempotent, so this safely upgrades
-- an `assignments` table created by an earlier version of this schema too.
alter table assignments add column if not exists assigned_by integer references users(id) on delete set null;
alter table assignments add column if not exists deadline date;
alter table assignments add column if not exists read_at timestamptz;

-- One row per chat Q&A. Private to the asker (never shown to teammates —
-- that's what repo_messages/Discussion is for) — just persisted so it
-- survives a page refresh or switching repos and back.
create table if not exists qa_history (
  id             serial primary key,
  repository_id  integer not null references repositories(id) on delete cascade,
  user_id        integer not null references users(id) on delete cascade,
  question       text not null,
  answer         text not null,
  sources        text[],
  created_at     timestamptz not null default now()
);
create index if not exists qa_history_repo_user_idx on qa_history (repository_id, user_id);
