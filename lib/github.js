// Thin wrapper around the GitHub REST API. Every function takes the caller's
// OAuth access token explicitly rather than reading it from a global, so
// routes stay easy to test and reason about.
import crypto from "crypto";

const GITHUB_API = "https://api.github.com";

async function githubFetch(token, path, options = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${options.method || "GET"} ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

export async function getRepo(token, owner, repo) {
  return githubFetch(token, `/repos/${owner}/${repo}`);
}

// Recursively lists every file path in the repo's default branch.
export async function getRepoTree(token, owner, repo, branch) {
  const tree = await githubFetch(token, `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
  return (tree.tree || []).filter((entry) => entry.type === "blob");
}

// Fetches a single file's text content via the contents API (base64-decoded).
export async function getFileContent(token, owner, repo, filePath, ref) {
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const data = await githubFetch(
    token,
    `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`
  );
  if (data.encoding !== "base64" || typeof data.content !== "string") return null;
  return Buffer.from(data.content, "base64").toString("utf8");
}

export async function getIssues(token, owner, repo, state = "open") {
  // GitHub's issues endpoint also returns pull requests; callers filter those out.
  return githubFetch(token, `/repos/${owner}/${repo}/issues?state=${state}&per_page=100`);
}

export async function getRecentCommits(token, owner, repo, sinceISODate) {
  return githubFetch(
    token,
    `/repos/${owner}/${repo}/commits?since=${encodeURIComponent(sinceISODate)}&per_page=100`
  );
}

// Who has access to this repo — used to show "who's invited" on the team panel.
// Requires the requesting user to have at least push access to the repo;
// GitHub returns a 403 for read-only collaborators, which the caller handles.
export async function getCollaborators(token, owner, repo) {
  return githubFetch(token, `/repos/${owner}/${repo}/collaborators?per_page=100`);
}

// Returns the list of files touched by a commit (used for module ownership).
export async function getCommitFiles(token, owner, repo, sha) {
  const data = await githubFetch(token, `/repos/${owner}/${repo}/commits/${sha}`);
  return data.files || [];
}

export async function postIssueComment(token, owner, repo, issueNumber, body) {
  return githubFetch(token, `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

// Creates a brand-new issue — used to let a user turn a bug-scan finding
// into a real GitHub issue with one click. Requires the requesting token to
// have at least write access to the repo (GitHub itself enforces this).
export async function createIssue(token, owner, repo, title, body, labels = []) {
  return githubFetch(token, `/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, labels }),
  });
}

export async function addIssueLabel(token, owner, repo, issueNumber, label) {
  return githubFetch(token, `/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ labels: [label] }),
  });
}

// Retrieves the latest commit SHA of a given branch
export async function getBranchSha(token, owner, repo, branch = "main") {
  const refData = await githubFetch(
    token,
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`
  );
  return refData.object.sha;
}

// Ensures that the authenticated user has a fork of owner/repo under userLogin
export async function ensureFork(token, owner, repo, userLogin) {
  try {
    const existing = await githubFetch(token, `/repos/${userLogin}/${repo}`);
    if (existing && existing.id) {
      return existing;
    }
  } catch (err) {
    if (!err.message?.includes("404")) {
      throw err;
    }
  }

  // Trigger fork creation on GitHub
  const created = await githubFetch(token, `/repos/${owner}/${repo}/forks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ default_branch_only: false }),
  });

  // Forking is asynchronous on GitHub; poll up to 6 times (1.5s interval) until accessible
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const ready = await githubFetch(token, `/repos/${userLogin}/${repo}`);
      if (ready && ready.id) {
        return ready;
      }
    } catch {
      // Still provisioning on GitHub
    }
  }

  return created;
}

// Creates a new git branch from a commit SHA or a branch name
export async function createBranch(token, owner, repo, branchName, baseShaOrBranch = "main") {
  let sha = baseShaOrBranch;
  if (typeof baseShaOrBranch !== "string" || !/^[0-9a-f]{40}$/i.test(baseShaOrBranch)) {
    sha = await getBranchSha(token, owner, repo, baseShaOrBranch || "main");
  }

  return githubFetch(token, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha,
    }),
  });
}

// Creates or updates a file directly on a specific git branch
export async function createOrUpdateFile(token, owner, repo, filePath, content, message, branch) {
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  let fileSha = null;
  try {
    const existing = await githubFetch(
      token,
      `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
    );
    fileSha = existing.sha;
  } catch {
    // New file, no sha required
  }

  return githubFetch(token, `/repos/${owner}/${repo}/contents/${encodedPath}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      ...(fileSha ? { sha: fileSha } : {}),
    }),
  });
}

// Opens a Pull Request from headBranch into baseBranch
export async function createPullRequest(token, owner, repo, title, body, headBranch, baseBranch = "main") {
  return githubFetch(token, `/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      body,
      head: headBranch,
      base: baseBranch,
    }),
  });
}

// Compares two commit SHAs and returns changed files
export async function compareCommits(token, owner, repo, baseSha, headSha) {
  return githubFetch(
    token,
    `/repos/${owner}/${repo}/compare/${encodeURIComponent(baseSha)}...${encodeURIComponent(headSha)}`
  );
}

// Verifies the X-Hub-Signature-256 header GitHub sends on webhook deliveries,
// using a constant-time comparison so we don't leak timing information.
export function verifyWebhookSignature(secret, rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Extensions we bother indexing. Widened to cover most real-world source
// files a repo might have — HTML/CSS/frontend frameworks, more languages,
// shell/config/infra files, etc. Anything genuinely binary (images, fonts,
// compiled artifacts) still isn't here on purpose.
const INDEXABLE_EXTENSIONS = new Set([
  // JS/TS ecosystem + frontend frameworks
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro",
  ".html", ".htm", ".css", ".scss", ".sass", ".less",
  // Backend languages
  ".py", ".go", ".java", ".rb", ".rs", ".c", ".cpp", ".cc", ".h", ".hpp",
  ".cs", ".php", ".kt", ".kts", ".swift", ".dart", ".scala", ".ex", ".exs",
  // Data / markup / config
  ".md", ".mdx", ".json", ".yml", ".yaml", ".toml", ".xml", ".sql", ".graphql", ".proto",
  // Scripts / infra
  ".sh", ".bash", ".ps1", ".dockerfile", ".env.example",
]);
// Filenames with no extension that are still worth indexing.
const INDEXABLE_FILENAMES = new Set(["Dockerfile", "Makefile", "README", "LICENSE"]);

const IGNORED_PATH_SEGMENTS = [
  "node_modules/", "dist/", "build/", ".next/", "vendor/", "__pycache__/",
  ".git/", "coverage/", ".turbo/", "out/",
];

export function isIndexableFile(path, sizeBytes) {
  if (sizeBytes && sizeBytes > 200_000) return false; // skip very large files
  if (IGNORED_PATH_SEGMENTS.some((seg) => path.includes(seg))) return false;
  const filename = path.split("/").pop();
  if (INDEXABLE_FILENAMES.has(filename)) return true;
  const dot = path.lastIndexOf(".");
  if (dot === -1) return false;
  return INDEXABLE_EXTENSIONS.has(path.slice(dot));
}

// Searches code across the entire GitHub repository. Useful as a coarse fallback
// when an issue or question references files outside the pre-indexed set.
export async function searchCode(token, owner, repo, query) {
  try {
    const q = `${encodeURIComponent(query)}+repo:${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const data = await githubFetch(token, `/search/code?q=${q}&per_page=5`);
    return (data.items || []).map((item) => item.path);
  } catch (err) {
    console.warn("GitHub code search failed or rate-limited:", err.message);
    return [];
  }
}

