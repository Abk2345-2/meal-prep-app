// Shared types + API client for PantryToPlate

// ── Types ──────────────────────────────────────────────────────────────────

export interface ParsedItem {
  name: string;
  quantity: number;
  unit: string;
}

export interface PantryItem {
  id: string;
  user_id: string;
  raw_text: string;
  name: string;
  normalized_name: string;
  quantity: number;
  unit: string;
  category: string;
  added_at: string;
  expires_at?: string | null;
}

export interface RecipeSuggestion {
  id: string;
  title: string;
  image: string;
  category: string;
  area: string;
  instructions: string;
  source_url: string;
  ingredients: Array<{ name: string; measure: string }>;
  time_minutes: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  match_score: number;
  matching_ingredients: string[];
  missing_ingredients: string[];
}

export interface NutritionGoal {
  user_id: string;
  daily_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface NutritionTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: number;
}

export interface TodayNutrition {
  goal: NutritionGoal;
  totals: NutritionTotals;
  calories_remaining: number;
  meals: Array<{
    id: string;
    source: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    logged_at: string;
  }>;
}

export interface Streak {
  current_streak: number;
  longest_streak: number;
  last_active: string;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  points_needed: number;
  sort_order: number;
  unlocked: boolean;
}

export interface GamificationSummary {
  streak: Streak;
  total_points: number;
  next_reward: Reward | null;
}

// ── Text parser ─────────────────────────────────────────────────────────────

export function parseText(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const parts = text.split(/,\s*|\s+and\s+/i).filter(Boolean);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(kg|g|lbs?|oz|dozen)?\s+(.+)$/i);
    if (match) {
      let qty = parseFloat(match[1]);
      let unit = (match[2] || 'unit').toLowerCase();
      let name = match[3].trim();
      if (unit === 'dozen') { qty *= 12; unit = 'unit'; }
      name = name.charAt(0).toUpperCase() + name.slice(1);
      items.push({ name, quantity: qty, unit });
    } else {
      const name = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      items.push({ name, quantity: 1, unit: 'unit' });
    }
  }
  return items;
}

// ── API client ──────────────────────────────────────────────────────────────

export class ApiClient {
  private base: string;

  constructor(options: { baseUrl: string }) {
    this.base = options.baseUrl.replace(/\/$/, '');
  }

  private async json<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await fetch(input, init);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  // Pantry
  async listPantry(): Promise<{ items: PantryItem[] }> {
    return this.json(`${this.base}/api/pantry/items`);
  }

  async addGroceries(payload: { text: string }): Promise<void> {
    await this.json(`${this.base}/api/pantry/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async deletePantryItem(id: string): Promise<void> {
    await fetch(`${this.base}/api/pantry/items/${id}`, { method: 'DELETE' });
  }

  // Recipes
  async suggestRecipes(params: {
    ingredients: string[];
    max_time?: number;
    limit?: number;
    min_match?: number;
  }): Promise<{ recipes: RecipeSuggestion[] }> {
    return this.json(`${this.base}/api/recipes/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }

  // Nutrition
  async today(): Promise<TodayNutrition> {
    return this.json(`${this.base}/api/nutrition/today`);
  }

  async logMeal(payload: {
    source: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }): Promise<void> {
    await this.json(`${this.base}/api/nutrition/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  // Gamification
  async summary(): Promise<GamificationSummary> {
    return this.json(`${this.base}/api/gamification/summary`);
  }

  async sendEvent(action: string): Promise<void> {
    await this.json(`${this.base}/api/gamification/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
  }

  async story(): Promise<{ share_text: string; meals_cooked: number; current_streak: number; total_points: number }> {
    return this.json(`${this.base}/api/gamification/story`);
  }
}
