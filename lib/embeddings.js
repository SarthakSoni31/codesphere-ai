// Embeddings power retrieval: we embed every code chunk once at index time,
// and embed each incoming question at chat time, then compare vectors in
// Postgres (pgvector) to find the most relevant chunks.
//
// Runs fully LOCALLY using Xenova/all-MiniLM-L6-v2 (via transformers.js) —
// no API key, no per-request cost, and no rate limits, unlike a hosted
// embedding API. The first call downloads the model (~90MB) from Hugging
// Face and caches it on disk; every call after that is instant and offline.
// Gemini is still used for chat answers (lib/llm.js), just not for this.
import { pipeline } from "@xenova/transformers";

const MODEL = "Xenova/all-MiniLM-L6-v2"; // 384 dimensions, matches db/schema.sql
const BATCH_SIZE = 32; // keep memory use reasonable when embedding many chunks at once

let extractorPromise;
function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL);
  }
  return extractorPromise;
}

// texts: string[] -> number[][] (same order as input)
export async function embedTexts(texts) {
  const extractor = await getExtractor();
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const output = await extractor(batch, { pooling: "mean", normalize: true });
    vectors.push(...output.tolist());
  }
  return vectors;
}

export async function embedText(text) {
  const [vector] = await embedTexts([text]);
  return vector;
}

// pgvector expects a literal like '[0.1,0.2,...]'
export function toVectorLiteral(embedding) {
  return `[${embedding.join(",")}]`;
}
