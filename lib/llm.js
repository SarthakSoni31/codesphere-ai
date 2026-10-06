// All calls to the LLM that generates human-facing text: grounded chat
// answers (with citations) and issue summaries/labels for the auto-triage bot.
//
// Uses Google's Gemini API. Get a free API key at https://aistudio.google.com/apikey
import { GoogleGenerativeAI } from "@google/generative-ai";

let client;
function getClient() {
  if (!client) {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is not set. Copy .env.example to .env.local and fill it in.");
    }
    client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  }
  return client;
}

// "flash-lite" instead of full "flash": far higher free-tier daily quota
// (the full model was capped at just 20 requests/day). The "-latest" alias
// self-updates as Google renames things, instead of hardcoding a dated
// model name that dies in a few months like the last two did.
const MODEL = "gemini-flash-lite-latest";

// Gemini is asked to respond with pure JSON, but sometimes includes things
// like a raw regex (`\d+`) inside a string field — valid to write, but
// invalid JSON unless the backslash is doubled (`\\d+`). Rather than fail
// and dump the raw text at the user, repair the most common cause (stray
// backslashes that aren't part of a real JSON escape sequence) and retry.
function parseModelJson(raw) {
  const cleaned = raw.replace(/^```json\s*|```\s*$/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const repaired = cleaned.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
    return JSON.parse(repaired); // let this throw if still broken — caller decides the fallback
  }
}

// chunks: [{ filePath, startLine, endLine, content }]
// Returns { answer: string, sources: string[] }.
export async function generateGroundedAnswer(question, chunks) {
  if (chunks.length === 0) {
    return {
      answer:
        "I couldn't find any indexed code relevant to that question. Try rephrasing, " +
        "or make sure the repository finished indexing.",
      sources: [],
    };
  }

  const context = chunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1}] ${c.filePath} (lines ${c.startLine}-${c.endLine})\n\`\`\`\n${c.content}\n\`\`\``
    )
    .join("\n\n");

  const system =
    "You are a codebase assistant in a chat interface — keep answers skimmable, not a report. " +
    "Answer the user's question using ONLY the provided code chunks; every claim must be " +
    "traceable to a chunk, and cite files as `path/to/file.js` inline near the claim they " +
    "support. Prefer 2-4 short paragraphs or a short bullet list over multiple headers — only " +
    "use a markdown header if the answer genuinely has several distinct sections. Don't restate " +
    "the question, don't add a horizontal rule, don't pad with boilerplate. If the chunks don't " +
    "contain enough information to answer confidently, say so plainly in one line instead of " +
    "guessing or listing everything you did find.";

  const model = getClient().getGenerativeModel({ model: MODEL, systemInstruction: system });
  const result = await model.generateContent(`Code context:\n\n${context}\n\nQuestion: ${question}`);

  const answer = result.response.text().trim();
  const lower = answer.toLowerCase();
  const isInsufficient =
    lower.includes("not contain enough information") ||
    lower.includes("cannot answer") ||
    lower.includes("insufficient information") ||
    lower.includes("couldn't find any indexed code");

  const sources = isInsufficient
    ? []
    : [...new Set(chunks.map((c) => `${c.filePath}:${c.startLine}-${c.endLine}`))];
  return { answer, sources };
}

// Returns { summary: string, label: string } for a newly opened issue.
export async function generateIssueSummary(title, body) {
  const system =
    "You triage GitHub issues. Given a title and body, write a one-sentence summary " +
    "and pick exactly one label from: bug, feature, question, documentation, chore. " +
    'Respond ONLY with JSON: {"summary": "...", "label": "..."} and nothing else.';

  const model = getClient().getGenerativeModel({ model: MODEL, systemInstruction: system });
  const result = await model.generateContent(`Title: ${title}\n\nBody:\n${body || "(no description)"}`);

  const raw = result.response.text().trim();
  try {
    const parsed = parseModelJson(raw);
    return { summary: parsed.summary, label: parsed.label };
  } catch {
    return { summary: raw.replace(/^```json\s*|```\s*$/g, "").trim(), label: "question" };
  }
}

// "Automatic bug detector": scans a sample of already-indexed chunks for
// likely bugs / risky patterns. This is a lightweight, on-demand static
// review — not a background scanner, and it never files issues itself, only
// surfaces findings for a human to act on (keeps it in line with the
// proposal's "never claim state-of-the-art accuracy" / no-auto-action stance).
// Returns an array of { filePath, issue } — filePath may be null if the
// model didn't cite one clearly.
export async function generateBugScan(chunks) {
  if (chunks.length === 0) return [];

  const context = chunks
    .map((c, i) => `[File ${i + 1}] ${c.filePath} (lines ${c.startLine}-${c.endLine})\n\`\`\`\n${c.content}\n\`\`\``)
    .join("\n\n");

  const system =
    "You are a senior engineer doing a real code review — not a linter. GitHub's own tools already " +
    "catch syntax errors and known security-pattern violations, so don't bother with those; focus on " +
    "things a compiler or linter CANNOT catch, specifically:\n" +
    "- Logic errors: code that runs fine but does the wrong thing (wrong condition, off-by-one, " +
    "wrong operator, inverted boolean, incorrect calculation).\n" +
    "- Security: data exposure, missing authorization checks, injection risk, secrets handled unsafely.\n" +
    "- Error handling: unhandled promise rejections, missing try/catch around I/O, swallowed errors, " +
    "requests that can hang or crash on bad input.\n" +
    "- Concurrency/state: race conditions, shared mutable state, non-atomic read-modify-write sequences.\n" +
    "- Data validation: missing checks on user input, trusting client-supplied IDs/roles, type coercion bugs.\n" +
    "For each finding, be specific: name the exact function/line behavior and what could actually go " +
    "wrong, not generic advice like 'add error handling'. Skip pure style nitpicks. List up to 8 " +
    "findings across as many of these categories as genuinely apply — don't force categories that " +
    "don't fit the code. If you find nothing concerning, return an empty list.\n" +
    'Respond ONLY with JSON: {"findings": [{"filePath": "...", "category": "Logic error|Security|' +
    'Error handling|Concurrency|Data validation", "issue": "one or two specific sentences"}]} and ' +
    "nothing else.";

  const model = getClient().getGenerativeModel({ model: MODEL, systemInstruction: system });
  const result = await model.generateContent(`Code to review:\n\n${context}`);

  const raw = result.response.text().trim();
  try {
    const parsed = parseModelJson(raw);
    return Array.isArray(parsed.findings) ? parsed.findings : [];
  } catch {
    // Genuinely unparseable even after the repair attempt — surface a clear
    // error instead of dumping the raw JSON blob at the user as a "finding".
    throw new Error("The AI's response wasn't valid — this is usually a transient formatting hiccup. Try scanning again.");
  }
}