const UNITS = 'kg|kgs|g|grams|gram|lb|lbs|pound|pounds|oz|ounce|ounces|cup|cups|tsp|tbsp|teaspoon|tablespoon|litre|liter|ml|l|dozen|half|bunch|bunches|packet|packets|pack|packs|piece|pieces|head|heads|clove|cloves|can|cans|bottle|bottles|jar|jars|box|boxes|bag|bags';

const WORD_TO_NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, hundred: 100, thousand: 1000,
  half: 0.5, quarter: 0.25, dozen: 12,
};

function wordsToDigits(text: string): string {
  // Replace standalone number words followed by a unit or nothing
  return text.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|hundred|thousand|half|quarter|dozen)\b/gi,
    (word) => {
      const n = WORD_TO_NUM[word.toLowerCase()];
      return n !== undefined ? String(n) : word;
    }
  );
}

const NAME_QTY_UNIT = new RegExp(`([a-zA-Z][a-zA-Z\\s]*)\\s+(\\d+(?:\\.\\d+)?)\\s*(${UNITS})\\b`, 'gi');

/**
 * formatGroceryTranscript normalises a Whisper transcript into a
 * comma-separated grocery list the parser can handle.
 *
 * Handles:
 *   "potato two kg"     → "potato 2 kg"  → "potato 2kg"
 *   "potato 2kg rice 300g" → "potato 2kg, rice 300g"
 *   "chicken and eggs"  → "chicken, eggs"
 */
export function formatGroceryTranscript(raw: string): string {
  if (!raw.trim()) return '';

  let text = raw.replace(/\s+/g, ' ').trim();

  // Convert spoken number words to digits first
  text = wordsToDigits(text);

  // Replace spoken connectors with commas
  text = text.replace(/\s*(?:,|;)\s*/g, ', ');
  text = text.replace(/\s+(?:and|plus|also|then|with)\s+/gi, ', ');

  // Protect "name qty unit" groups so we don't split them
  // e.g. "potato 2 kg" → "potato__2__kg"
  text = text.replace(NAME_QTY_UNIT, (_, name, qty, unit) => {
    return `${name.trim()}__${qty}__${unit}`;
  });

  // Restore protected groups (collapse any remaining spaces in the token)
  text = text.replace(/(\w)__(\d)/g, '$1 $2');
  text = text.replace(/(\d)__(\w)/g, '$1 $2');

  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.join(', ');
}
