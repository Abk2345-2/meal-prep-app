/**
 * formatGroceryTranscript converts a raw Whisper transcript like
 *   "chicken masala goji masala 500g rice"
 * into a comma-separated grocery list:
 *   "chicken masala, goji masala, 500g rice"
 *
 * Strategy:
 *   1. Split on explicit commas / "and" / "plus" / "also" / semicolons (already handled by backend parser).
 *   2. Additionally split on transitions from a named item to a quantity prefix (digit or
 *      common unit word) — e.g. "chicken masala 2 cups rice" → "chicken masala, 2 cups rice".
 *   3. Trim and collapse multiple spaces.
 */
export function formatGroceryTranscript(raw: string): string {
  if (!raw.trim()) return '';

  // Normalise: collapse whitespace, trim
  let text = raw.replace(/\s+/g, ' ').trim();

  // Step 1 — split on spoken connectors (already comma-friendly)
  // "chicken and rice" → "chicken, rice"
  text = text.replace(/\s*(?:,|;)\s*/g, ', ');
  text = text.replace(/\s+(?:and|plus|also|then|with)\s+/gi, ', ');

  // Step 2 — insert comma before a quantity that follows a non-numeric word
  // e.g. "chicken masala 2 cups rice" → "chicken masala, 2 cups rice"
  // Pattern: word-boundary, then digit OR unit-starting-word, but NOT if previous word IS a unit/qty
  const UNIT_WORDS =
    /\b(kg|g|grams?|kgs?|lb|lbs?|pound|oz|ounce|cup|cups|tsp|tbsp|teaspoon|tablespoon|litre|liter|ml|l|dozen|half|bunch|packet|pack|piece|pieces|head|clove|can)\b/i;

  // Insert comma before: a digit sequence, OR a unit word, when preceded by a non-unit, non-digit word
  text = text.replace(
    /([a-zA-Z])\s+(\d+(?:\.\d+)?|(?:kg|g|lb|oz|cup|cups|tsp|tbsp|ml|litre|liter|dozen|half|bunch|packet|head|clove|can)\b)/gi,
    (match, before, after) => {
      // Don't split if the preceding context is already a unit
      if (UNIT_WORDS.test(before)) return match;
      return `${before}, ${after}`;
    },
  );

  // Step 3 — clean up: remove double commas, trim each segment
  const parts = text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  return parts.join(', ');
}
