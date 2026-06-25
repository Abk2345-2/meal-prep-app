const UNITS = 'kg|kgs|g|grams|gram|lb|lbs|pound|pounds|oz|ounce|ounces|cup|cups|tsp|tbsp|teaspoon|tablespoon|litre|liter|ml|l|dozen|half|bunch|bunches|packet|packets|pack|packs|piece|pieces|head|heads|clove|cloves|can|cans|bottle|bottles|jar|jars|box|boxes|bag|bags';
const UNIT_RE = new RegExp(`\\b(${UNITS})\\b`, 'i');
// Matches "name qty unit" e.g. "potato 2kg" or "chicken 500 grams"
const NAME_QTY_UNIT = new RegExp(`([a-zA-Z][a-zA-Z\\s]*)\\s+(\\d+(?:\\.\\d+)?)\\s*(${UNITS})\\b`, 'gi');

/**
 * formatGroceryTranscript normalises a Whisper transcript into a
 * comma-separated grocery list the parser can handle.
 *
 * Handles:
 *   "potato 2kg rice 300g"   → "potato 2kg, rice 300g"
 *   "chicken and eggs"       → "chicken, eggs"
 *   "2kg potato"             → "2kg potato"   (already parseable)
 */
export function formatGroceryTranscript(raw: string): string {
  if (!raw.trim()) return '';

  let text = raw.replace(/\s+/g, ' ').trim();

  // Replace spoken connectors with commas
  text = text.replace(/\s*(?:,|;)\s*/g, ', ');
  text = text.replace(/\s+(?:and|plus|also|then|with)\s+/gi, ', ');

  // Protect "name qty unit" groups — replace the space before qty with a
  // placeholder so we don't accidentally split them later.
  // e.g. "potato 2kg" → "potato__2kg"
  text = text.replace(NAME_QTY_UNIT, (_, name, qty, unit) => {
    return `${name.trim()}__${qty}${unit}`;
  });

  // Now split on word-digit boundary ONLY when not already comma-separated
  // and the digit is NOT part of a protected group
  text = text.replace(
    /([a-zA-Z])\s+(\d+(?:\.\d+)?\s*(?:kg|g|lb|oz|cup|cups|tsp|tbsp|ml|litre|liter|dozen|bunch|pack|piece|clove|can|bottle|jar|box|bag)\b)/gi,
    (match, before, after) => {
      if (UNIT_RE.test(before)) return match;
      return `${before}, ${after}`;
    },
  );

  // Restore protected groups
  text = text.replace(/__/g, ' ');

  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.join(', ');
}
