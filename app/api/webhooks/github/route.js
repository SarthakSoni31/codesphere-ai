import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import {
  verifyWebhookSignature,
  postIssueComment,
  addIssueLabel,
  getFileContent,
  isIndexableFile,
} from "../../../../lib/github";
import { generateIssueSummary, generateGroundedAnswer } from "../../../../lib/llm";
import { findRelevantChunks } from "../../../../lib/retrieval";
import { chunkFile } from "../../../../lib/chunk";
import { embedTexts, toVectorLiteral } from "../../../../lib/embeddings";

// Configure this in each repo's Settings -> Webhooks:
//   Payload URL: {NEXT_PUBLIC_APP_URL}/api/webhooks/github
//   Content type: application/json
//   Secret: GITHUB_WEBHOOK_SECRET
//   Events: "Issues", "Pushes"
export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!process.env.GITHUB_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "GITHUB_WEBHOOK_SECRET not configured" }, { status: 500 });
  }
  if (!verifyWebhookSignature(process.env.GITHUB_WEBHOOK_SECRET, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  const payload = JSON.parse(rawBody);

  // 1. Handle 'push' events for Real-Time Incremental Git Diff Syncing
  if (event === "push") {
    const owner = payload.repository.owner.login || payload.repository.owner.name;
    const repo = payload.repository.name;
    const ref = payload.ref;

    const db = getDb();
    const { rows } = await db.query(
      `SELECT r.id AS repository_id, r.default_branch, u.access_token
       FROM repositories r JOIN users u ON u.id = r.user_id
       WHERE r.owner = $1 AND r.name = $2`,
      [owner, repo]
    );
    if (rows.length === 0) {
      return NextResponse.json({ skipped: true, reason: "Repository not connected" });
    }

    const { repository_id: repositoryId, default_branch: defaultBranch, access_token: token } = rows[0];

    // Only process pushes to the repository's default branch
    if (ref !== `refs/heads/${defaultBranch || "main"}`) {
      return NextResponse.json({ skipped: true, reason: "Push is not on default branch" });
    }

    const commits = payload.commits || [];
    const addedFiles = new Set();
    const modifiedFiles = new Set();
    const removedFiles = new Set();

    for (const c of commits) {
      (c.added || []).forEach((f) => addedFiles.add(f));
      (c.modified || []).forEach((f) => modifiedFiles.add(f));
      (c.removed || []).forEach((f) => removedFiles.add(f));
    }

    let syncedCount = 0;

    // Delete removed files from chunks
    for (const filePath of removedFiles) {
      await db.query(`DELETE FROM chunks WHERE repository_id = $1 AND file_path = $2`, [
        repositoryId,
        filePath,
      ]);
      syncedCount++;
    }

    // Re-chunk modified and newly added files
    const filesToSync = new Set([...addedFiles, ...modifiedFiles]);
    for (const filePath of filesToSync) {
      if (removedFiles.has(filePath)) continue;
      if (!isIndexableFile(filePath)) continue;

      await db.query(`DELETE FROM chunks WHERE repository_id = $1 AND file_path = $2`, [
        repositoryId,
        filePath,
      ]);

      const content = await getFileContent(token, owner, repo, filePath, defaultBranch || "main");
      if (!content) continue;

      const fileChunks = chunkFile(content);
      if (fileChunks.length === 0) continue;

      const embeddings = await embedTexts(fileChunks.map((c) => `File: ${filePath}\n\n${c.text}`));
      for (let i = 0; i < fileChunks.length; i++) {
        const fc = fileChunks[i];
        await db.query(
          `INSERT INTO chunks (repository_id, file_path, start_line, end_line, content, embedding)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [repositoryId, filePath, fc.startLine, fc.endLine, fc.text, toVectorLiteral(embeddings[i])]
        );
      }
      syncedCount++;
    }

    await db.query(
      `UPDATE repositories SET last_commit_sha = $1, indexed_at = now() WHERE id = $2`,
      [payload.after || null, repositoryId]
    );

    return NextResponse.json({ ok: true, event: "push", syncedFiles: syncedCount });
  }

  // 2. Handle 'issues' opened events for AI Auto-Triage
  if (event !== "issues" || payload.action !== "opened") {
    // Not something we act on (edits, closes, PR events, etc.) - ack and skip.
    return NextResponse.json({ skipped: true });
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issue = payload.issue;

  const db = getDb();
  try {
    // The bot posts using the token of whoever connected this repo in our app.
    const { rows } = await db.query(
      `SELECT r.id AS repository_id, r.default_branch, u.access_token
       FROM repositories r JOIN users u ON u.id = r.user_id
       WHERE r.owner = $1 AND r.name = $2`,
      [owner, repo]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Repository not connected to CodeSphere AI" }, { status: 404 });
    }
    const { repository_id: repositoryId, default_branch: defaultBranch, access_token: token } = rows[0];

    const { summary, label } = await generateIssueSummary(issue.title, issue.body);

    // Retrieval-augmented "where to look" section: reuse the same chat
    // pipeline, but ask it about the issue instead of a user's typed
    // question, grounded in this repo's already-indexed source.
    let codePointer = "";
    try {
      const diagnosticQuestion = `A user reported this bug/issue:\nTitle: "${issue.title}"\n${issue.body ? `Description:\n${issue.body}\n` : ""}\nWhich files in the codebase are responsible for this, and what specifically should someone inspect or fix?`;
      const chunks = await findRelevantChunks(db, {
        repositoryId,
        query: diagnosticQuestion,
        contextText: `${issue.title} ${issue.body || ""}`,
        limit: 5,
        isCodeQuestion: true,
        githubContext: {
          token,
          owner,
          repo,
          defaultBranch: defaultBranch || "main",
        },
      });

      if (chunks.length > 0) {
        const { answer, sources } = await generateGroundedAnswer(diagnosticQuestion, chunks);
        // Only append codePointer if the model actually cited grounded sources
        if (sources.length > 0) {
          codePointer = `\n\n**Where to look:** ${answer}`;
        }
      }
    } catch (err) {
      // Non-fatal: if retrieval fails for any reason, still post the
      // summary+label — a partial comment beats no comment.
      console.error("Fix-suggestion retrieval failed (posting summary only):", err);
    }

    await postIssueComment(
      token,
      owner,
      repo,
      issue.number,
      `**CodeSphere AI summary:** ${summary}\n\n*Suggested label: \`${label}\`*${codePointer}`
    );
    // Best-effort: only works if the label already exists on the repo.
    await addIssueLabel(token, owner, repo, issue.number, label).catch(() => {});

    await db.query(
      `INSERT INTO issue_summaries (repository_id, issue_number, summary, suggested_label)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (repository_id, issue_number) DO UPDATE SET summary = $3, suggested_label = $4`,
      [repositoryId, issue.number, summary, label]
    );

    return NextResponse.json({ ok: true, summary, label });
  } catch (err) {
    console.error("Webhook handling failed:", err);
    return NextResponse.json({ error: err.message || "Webhook handling failed" }, { status: 500 });
  }
}
