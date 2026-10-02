const fs = require('fs');
const path = require('path');

const ADVISORY_PATH = path.join(__dirname, '..', 'data', 'icar_paddy_advisory.txt');

let cachedChunks = null;

/**
 * Loads the advisory file once and splits it into numbered-section chunks.
 */
function loadChunks() {
  if (cachedChunks) return cachedChunks;

  const raw = fs.readFileSync(ADVISORY_PATH, 'utf-8');
  // Split on numbered section headers like "1. SOWING..."
  const sections = raw.split(/\n(?=\d+\.\s)/).map((s) => s.trim()).filter(Boolean);

  cachedChunks = sections;
  return sections;
}

/**
 * Very simple keyword-overlap retrieval - good enough for a small (1-2 doc)
 * advisory corpus without needing a vector database for the prototype.
 * Swap this for embeddings + a vector store (e.g. Chroma, Pinecone free tier)
 * if you scale to more documents later.
 */
function retrieveRelevantAdvisory(query, topN = 2) {
  const chunks = loadChunks();
  const queryWords = query.toLowerCase().match(/[a-z]+/g) || [];

  const scored = chunks.map((chunk) => {
    const chunkLower = chunk.toLowerCase();
    const score = queryWords.reduce(
      (acc, word) => acc + (chunkLower.includes(word) ? 1 : 0),
      0
    );
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter((s) => s.score > 0)
    .slice(0, topN)
    .map((s) => s.chunk);
}

module.exports = { retrieveRelevantAdvisory };
