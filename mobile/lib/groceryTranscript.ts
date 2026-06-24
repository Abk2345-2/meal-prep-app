/**
 * formatGroceryTranscript converts a raw Whisper transcript like
 *   "chicken masala 500g rice"
 * into a comma-separated grocery list:
 *   "chicken masala, 500g rice"
 */
export function formatGroceryTranscript(raw: string): string {
  if (!raw.trim()) return '';

  let text = raw.replace(/\s+/g, ' ').trim();

  // Split on spoken connectors
  text = text.replace(/\s*(?:,|;)\s*/g, ', ');
  text = text.replace(/\s+(?:and|plus|also|then|with)\s+/gi, ', ');

  const UNIT_WORDS =
    /\b(kg|g|grams?|kgs?|lb|lbs?|pound|oz|ounce|cup|cups|tsp|tbsp|teaspoon|tablespoon|litre|liter|ml|l|dozen|half|bunch|packet|pack|piece|pieces|head|clove|can)\b/i;

  text = text.replace(
    /([a-zA-Z])\s+(\d+(?:\.\d+)?|(?:kg|g|lb|oz|cup|cups|tsp|tbsp|ml|litre|liter|dozen|half|bunch|packet|head|clove|can)\b)/gi,
    (match, before, after) => {
      if (UNIT_WORDS.test(before)) return match;
      return `${before}, ${after}`;
    },
  );

  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.join(', ');
}
