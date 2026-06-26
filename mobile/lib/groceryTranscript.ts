/**
 * formatGroceryTranscript — turns a Whisper voice transcript into a
 * comma-separated grocery string that the Go backend ParseText can handle.
 *
 * Supported input patterns (all case-insensitive):
 *   "potato"                     → "potato"
 *   "two kg potato"              → "2 kg potato"
 *   "potato two kg"              → "potato 2 kg"
 *   "half kg onion"              → "0.5 kg onion"
 *   "3 eggs"                     → "3 eggs"
 *   "a dozen eggs"               → "12 eggs"
 *   "potato 2kg and rice 300g"   → "potato 2kg, rice 300g"
 *   "milk, bread, and 2 eggs"    → "milk, bread, 2 eggs"
 *   "doodh ek litre"             → "doodh 1 litre"   (Hindi numerals)
 *   "ek kilo aata"               → "1 kilo aata"
 */

const WORD_TO_NUM: Record<string, number> = {
  // English
  zero: 0, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, thousand: 1000,
  half: 0.5, quarter: 0.25, dozen: 12, couple: 2, few: 3,
  // Hindi
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  aadha: 0.5,
  // Common aliases
  'a dozen': 12, 'half a': 0.5,
};

const UNIT_ALIASES: Record<string, string> = {
  // Weight
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  g: 'g', gram: 'g', grams: 'g', grm: 'g',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  // Volume
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml',
  cup: 'cup', cups: 'cup',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  // Count
  dozen: 'dozen', dozens: 'dozen',
  piece: 'unit', pieces: 'unit', pcs: 'unit',
  head: 'head', heads: 'head',
  clove: 'clove', cloves: 'clove',
  bunch: 'bunch', bunches: 'bunch',
  pack: 'pack', packs: 'pack', packet: 'pack', packets: 'pack',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  bottle: 'bottle', bottles: 'bottle',
  jar: 'jar', jars: 'jar',
  box: 'box', boxes: 'box',
  bag: 'bag', bags: 'bag',
  // Hindi units
  kilo: 'kg', litre: 'l', graam: 'g',
};

const UNIT_PATTERN = Object.keys(UNIT_ALIASES).join('|');
const NUM_WORDS = Object.keys(WORD_TO_NUM)
  .filter(k => k.length > 1 || k === 'a') // skip single-char 'g' etc
  .sort((a, b) => b.length - a.length) // longest first for greedy match
  .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

function wordsToDigits(text: string): string {
  // Replace word numbers (longest match first)
  return text.replace(
    new RegExp(`\\b(${NUM_WORDS})\\b`, 'gi'),
    (word) => {
      const n = WORD_TO_NUM[word.toLowerCase()];
      return n !== undefined ? String(n) : word;
    },
  );
}

function normalizeUnits(text: string): string {
  return text.replace(
    new RegExp(`\\b(${UNIT_PATTERN})\\b`, 'gi'),
    (unit) => UNIT_ALIASES[unit.toLowerCase()] ?? unit,
  );
}

export function formatGroceryTranscript(raw: string): string {
  if (!raw.trim()) return '';

  let text = raw.replace(/\s+/g, ' ').trim();

  // 1. Convert number words → digits
  text = wordsToDigits(text);

  // 2. Normalize unit words → canonical forms
  text = normalizeUnits(text);

  // 3. Split on spoken connectors and punctuation
  //    Keep "and" only as a separator, not when it's part of a name
  text = text.replace(/\s*(?:,|;)\s*/g, ', ');
  // "and" / "plus" / "also" used as item separators
  text = text.replace(/\s+(?:and|plus|also|then)\s+(?=\d|[A-Z])/gi, ', ');
  // Simple "and" between two items where the next item doesn't start with a digit
  text = text.replace(/\s+and\s+/gi, ', ');

  // 4. Clean up
  text = text.replace(/\s+/g, ' ').trim();

  const parts = text.split(',').map(p => p.trim()).filter(Boolean);
  return parts.join(', ');
}
