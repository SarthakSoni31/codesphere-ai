// Splits a file's text into chunks for embedding + retrieval.
//
// This is intentionally simple (per the proposal, retrieval correctness over
// research novelty): try to break on function/class boundaries for common
// languages, and fall back to fixed-size line windows with overlap for
// everything else (markdown, config, unrecognized languages).

const BOUNDARY_REGEX =
  /^\s*(export\s+)?(default\s+)?(async\s+)?(function|class)\s+\w+|^\s*(func|fn|pub\s+fn|def)\s+\w+|^\s*class\s+\w+[:(]/;

const WINDOW_SIZE = 40; // lines per fallback chunk
const WINDOW_OVERLAP = 5; // lines shared between consecutive fallback chunks
const MAX_CHUNK_CHARS = 4000; // keep embeddings + prompts small

export function chunkFile(content) {
  const lines = content.split("\n");
  const rawBoundaries = [0];
  for (let i = 1; i < lines.length; i++) {
    if (BOUNDARY_REGEX.test(lines[i])) rawBoundaries.push(i);
  }

  // Filter out boundaries that are too close together (< 8 lines apart)
  // so we never produce 1-line stub chunks that lack actual code content.
  const boundaries = [0];
  for (let i = 1; i < rawBoundaries.length; i++) {
    const prev = boundaries[boundaries.length - 1];
    if (rawBoundaries[i] - prev >= 8) {
      boundaries.push(rawBoundaries[i]);
    }
  }

  let chunks;
  if (boundaries.length > 1) {
    chunks = boundaries.map((start, idx) => {
      const end = idx + 1 < boundaries.length ? boundaries[idx + 1] : lines.length;
      return { startLine: start + 1, endLine: end, text: lines.slice(start, end).join("\n") };
    });
  } else {
    chunks = [];
    for (let start = 0; start < lines.length; start += WINDOW_SIZE - WINDOW_OVERLAP) {
      const end = Math.min(start + WINDOW_SIZE, lines.length);
      chunks.push({ startLine: start + 1, endLine: end, text: lines.slice(start, end).join("\n") });
      if (end === lines.length) break;
    }
  }

  // Guard against pathologically long single "boundary" chunks (e.g. a huge class).
  return chunks
    .filter((c) => c.text.trim().length > 0)
    .map((c) => (c.text.length > MAX_CHUNK_CHARS ? { ...c, text: c.text.slice(0, MAX_CHUNK_CHARS) } : c));
}
