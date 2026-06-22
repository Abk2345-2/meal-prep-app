// Lightweight client-side mirror of the Go quantity parser
// (backend/internal/pantry/parser.go). Used to show an instant preview of parsed
// grocery chips as the user types/speaks, before they confirm and save. The
// backend re-parses on save, so this only needs to be good enough for preview.

import type { ParsedItem } from './types';

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, dozen: 12, half: 0.5, couple: 2,
};

const UNIT_ALIASES: Record<string, string> = {
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  kg: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg',
  g: 'g', gram: 'g', grams: 'g',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  cup: 'cup', cups: 'cup',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  l: 'l', liter: 'l', liters: 'l',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml',
  head: 'head', heads: 'head',
  clove: 'clove', cloves: 'clove',
  can: 'can', cans: 'can',
  pack: 'pack', packs: 'pack', packet: 'pack',
  bunch: 'bunch', bunches: 'bunch',
  piece: 'unit', pieces: 'unit', unit: 'unit', units: 'unit',
};

function categoryFor(name: string): string {
  const has = (...subs: string[]) => subs.some((s) => name.includes(s));
  if (has('chicken', 'beef', 'pork', 'turkey', 'lamb', 'bacon', 'sausage')) return 'meat';
  if (has('fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'cod')) return 'seafood';
  if (has('milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg')) return 'dairy';
  if (has('broccoli', 'spinach', 'lettuce', 'tomato', 'carrot', 'onion', 'potato',
    'pepper', 'cucumber', 'apple', 'banana', 'lemon', 'garlic', 'celery')) return 'produce';
  if (has('rice', 'pasta', 'bread', 'flour', 'oats', 'cereal', 'noodle')) return 'grain';
  if (has('oil', 'sugar', 'salt', 'sauce', 'spice', 'can', 'bean')) return 'pantry';
  return 'other';
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const LEADING_QTY = /^\s*([0-9]+(?:\.[0-9]+)?|[a-zA-Z]+)\s*([a-zA-Z]+)?\b/;

export function parseLine(line: string): ParsedItem {
  const raw = line.trim();
  let rest = raw;
  let quantity = 1;
  let unit = 'unit';

  const m = LEADING_QTY.exec(rest);
  if (m) {
    const token = m[1].toLowerCase();
    let matched = false;
    const num = Number(token);
    if (!Number.isNaN(num) && token !== '') {
      quantity = num;
      matched = true;
    } else if (token in WORD_NUMBERS) {
      quantity = WORD_NUMBERS[token];
      matched = true;
    }
    if (matched) {
      // Handle glued unit like "500g": regex puts "g" in group 2.
      let consumed = m[1];
      if (m[2] && UNIT_ALIASES[m[2].toLowerCase()]) {
        unit = UNIT_ALIASES[m[2].toLowerCase()];
        const idx = rest.indexOf(m[2]) + m[2].length;
        consumed = rest.slice(0, idx);
      }
      rest = rest.slice(consumed.length).trim();
    }
  }

  const name = titleCase(rest || raw);
  const normalized = name.toLowerCase();
  return {
    raw_text: raw,
    name,
    normalized_name: normalized,
    quantity,
    unit,
    category: categoryFor(normalized),
    shelf_life_days: 0,
  };
}

export function parseText(text: string): ParsedItem[] {
  return text
    .split(/\s*(?:,|;|\band\b|\bplus\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(parseLine);
}
