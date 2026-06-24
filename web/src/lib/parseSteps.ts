/**
 * parseInstructionSteps — turns any recipe instruction string into a clean
 * ordered list of step strings.
 *
 * Handles all formats present in the dataset:
 *   A. "step 1\nDo this.\n\nstep 2\nDo that."   → MealDB step-header format
 *   B. "Do this.\r\n\r\nDo that."               → MealDB paragraph format
 *   C. "Do this.Heat oil.Add spices."            → CSV packed run-on sentences
 *   D. Combinations of the above
 */
export function parseInstructionSteps(raw: string): string[] {
  if (!raw?.trim()) return [];

  let text = raw
    .replace(/ /g, ' ')   // non-breaking spaces
    .replace(/\r\n/g, '\n')    // normalise line endings
    .replace(/\r/g, '\n');

  // ── Strategy A: explicit "step N" labels ─────────────────────────────────
  if (/\bstep\s+\d+\b/i.test(text)) {
    // Remove "step N" prefix lines, split on them, keep the body of each
    const chunks = text
      .split(/\bstep\s+\d+[:\s\-]*/gi)
      .map((s) => s.trim())
      .filter(Boolean);
    if (chunks.length > 1) return chunks.flatMap(chunkToSentences);
  }

  // ── Strategy B: paragraph breaks (one or more blank lines) ───────────────
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    // Each paragraph may itself be 2-4 sentences — break them too
    return paragraphs.flatMap(chunkToSentences);
  }

  // ── Strategy C: single long block — split on sentence boundaries ─────────
  return chunkToSentences(text);
}

/**
 * Split a chunk of text into individual sentences suitable as step bullets.
 * Avoids splitting on:
 *   - Abbreviations ending with a capital letter (Mr., Dr., etc.)
 *   - Decimal numbers (180.5)
 *   - Single-letter initials (U.S.)
 *   - Parenthetical periods "(approx.)"
 */
function chunkToSentences(chunk: string): string[] {
  // Protect known abbreviations / decimals
  const ABBREV = /\b(approx|approx|tbsp|tsp|oz|lb|lbs|kg|g|ml|fl|vol|temp|min|hr|hrs|no|vs|etc|e\.g|i\.e|Mr|Mrs|Dr|Sr|Jr|St|Ave|Blvd)\./gi;
  const placeholder = chunk.replace(ABBREV, (m) => m.replace('.', '‹DOT›'));

  // Split on ". " or "! " or "? " followed by a capital letter or digit
  const parts = placeholder
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.replace(/‹DOT›/g, '.').trim())
    .filter((s) => s.length > 10); // discard tiny fragments

  // Merge very short sentences (< 40 chars) into previous step
  const merged: string[] = [];
  for (const part of parts) {
    if (merged.length > 0 && merged[merged.length - 1].length + part.length < 80) {
      merged[merged.length - 1] += ' ' + part;
    } else {
      merged.push(part);
    }
  }

  return merged.length > 0 ? merged : [chunk.trim()];
}
