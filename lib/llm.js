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
// repoContext: { owner, name, totalChunks, totalFiles, samplePaths }
// Returns { answer: string, sources: string[] }.
export async function generateGroundedAnswer(question, chunks, repoContext = null) {
  const isMetaQuestion =
    /what\s+(?:all\s+)?files|which\s+files|do\s+you\s+have\s+access|whole\s+repo|entire\s+repo|deep\s+index|indexed|coverage|all\s+code/i.test(
      question
    );

  if (chunks.length === 0) {
    if (repoContext && isMetaQuestion) {
      const fileList = (repoContext.samplePaths || []).slice(0, 15).map((f) => `- \`${f}\``).join("\n");
      return {
        answer:
          `CodeSphere has deep-indexed the entire repository **${repoContext.owner}/${repoContext.name}** with **${repoContext.totalChunks} chunks** across **${repoContext.totalFiles} source files** (covering both frontend and backend).\n\n` +
          `Because CodeSphere uses Retrieval-Augmented Generation (RAG) with local ONNX vector embeddings and PostgreSQL \`pgvector\`, the complete codebase is indexed in the vector database. For every specific question, the retrieval engine queries \`pgvector\` to pull the most relevant code chunks into context on demand with exact line citations.\n\n` +
          `**Key indexed files include:**\n${fileList}\n\n` +
          `Ask any specific question about authentication, routes, state management, or models, and I will retrieve the exact files and lines!`,
        sources: (repoContext.samplePaths || []).slice(0, 5).map((f) => `${f}:1-40`),
      };
    }

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

  const repoInfo = repoContext
    ? `\nRepository Status: ${repoContext.owner}/${repoContext.name} (${repoContext.totalChunks} chunks indexed across ${repoContext.totalFiles} files in pgvector). Sample paths: ${(repoContext.samplePaths || []).slice(0, 20).join(", ")}...\n`
    : "";

  const system =
    "You are CodeSphere Copilot, an AI codebase assistant in a chat interface — keep answers skimmable, not a report. " +
    repoInfo +
    "You have access to the complete repository via CodeSphere's deep-indexed ONNX pgvector knowledge base. " +
    "On every query, CodeSphere dynamically retrieves the most relevant code chunks into your context window. " +
    "Answer the user's question using the provided code chunks, citing files as `path/to/file.ext` inline near the claims they support. " +
    "CRITICAL GROUNDING & CITATION RULES:\n" +
    "1. Distinguish codebase implementation from general organization knowledge: If asked about open-source programs (like GSoC / Google Summer of Code), sponsorships, or non-code organizational context that is not declared in the codebase files, explicitly state that this is project/organizational background and not in the codebase itself. Do not pretend that unrelated code chunks define it.\n" +
    "2. If asked whether a specific keyword or symbol exists (e.g. 'is X written anywhere') and it is NOT found in the code, state clearly and plainly that it is not present in the indexed files.\n" +
    "3. At the very end of your response on its own line, list the chunk numbers that directly support your claims: `[CITED: Chunk 1, Chunk 2]` or write `[CITED: NONE]` if answering a negative query (something not found), general organizational knowledge, or if the chunks do not support the claims.\n" +
    "4. Prefer 2-4 short paragraphs or a short bullet list. Don't restate the question, don't pad with boilerplate.";

  const model = getClient().getGenerativeModel({ model: MODEL, systemInstruction: system });
  const result = await model.generateContent(`Code context:\n\n${context}\n\nQuestion: ${question}`);

  const rawAnswer = result.response.text().trim();
  let cleanAnswer = rawAnswer;
  let citedIndices = [];

  const citedMatch = cleanAnswer.match(/\[CITED:\s*([^\]]+)\]/i);
  if (citedMatch) {
    cleanAnswer = cleanAnswer.replace(/\[CITED:\s*[^\]]+\]/i, "").trim();
    const citedStr = citedMatch[1].trim().toLowerCase();
    if (citedStr !== "none") {
      const numbers = citedStr.match(/\d+/g);
      if (numbers) {
        citedIndices = numbers
          .map((n) => parseInt(n, 10) - 1)
          .filter((idx) => idx >= 0 && idx < chunks.length);
      }
    }
  }

  const lower = cleanAnswer.toLowerCase();
  const isInsufficient =
    lower.includes("not contain enough information") ||
    lower.includes("cannot answer") ||
    lower.includes("insufficient information") ||
    lower.includes("couldn't find any indexed code");

  const isNegativeAssertion =
    lower.includes("not mentioned anywhere") ||
    lower.includes("not found anywhere") ||
    lower.includes("yields no occurrences") ||
    lower.includes("no occurrences") ||
    lower.includes("not written anywhere") ||
    lower.includes("does not appear anywhere") ||
    lower.includes("not present anywhere");

  let sources = [];
  if (!isInsufficient && !isNegativeAssertion) {
    if (citedIndices.length > 0) {
      sources = [
        ...new Set(
          citedIndices.map((idx) => `${chunks[idx].filePath}:${chunks[idx].startLine}-${chunks[idx].endLine}`)
        ),
      ];
    } else {
      // Fallback: only cite chunks whose filePath (or file basename) is explicitly mentioned in the answer text
      const mentionedChunks = chunks.filter((c) => {
        const basename = c.filePath.split("/").pop();
        return (
          cleanAnswer.includes(c.filePath) ||
          (basename && basename.length > 4 && cleanAnswer.includes(basename))
        );
      });
      if (mentionedChunks.length > 0) {
        sources = [
          ...new Set(
            mentionedChunks.map((c) => `${c.filePath}:${c.startLine}-${c.endLine}`)
          ),
        ];
      }
    }
  }

  return { answer: cleanAnswer, sources };
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

// Generates a concrete technical solution and code fix for a GitHub issue,
// grounded in the provided codebase chunks. Ready to be reviewed, edited,
// and posted directly as a GitHub comment.
export async function generateIssueSolution(title, body, chunks) {
  if (chunks.length === 0) {
    return "No indexed code context was found to generate a specific solution.";
  }

  const context = chunks
    .map(
      (c, i) =>
        `[Context ${i + 1}] ${c.filePath} (lines ${c.startLine}-${c.endLine})\n\`\`\`\n${c.content}\n\`\`\``
    )
    .join("\n\n");

  const system =
    "You are an expert software engineer writing a solution / proposed fix comment for a GitHub issue. " +
    "Provide a practical, high-quality technical solution grounded strictly in the provided code context.\n" +
    "Structure your response clearly with:\n" +
    "1. **Root Cause & Approach**: 1-2 concise sentences.\n" +
    "2. **Proposed Code Fix**: Exact code snippet or diff ready to apply.\n" +
    "3. **Verification**: How to test or verify the fix.\n" +
    "Keep it professional and ready to be posted as a GitHub comment. Do not include markdown preamble like 'Here is the solution'.";

  const model = getClient().getGenerativeModel({ model: MODEL, systemInstruction: system });
  const result = await model.generateContent(
    `Issue Title: ${title}\nIssue Description: ${body || "(none)"}\n\nCode Context:\n${context}`
  );

  return result.response.text().trim();
}