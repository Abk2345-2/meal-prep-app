// Shared types for PantryToPlate

export interface ParsedItem {
  name: string;
  quantity: number;
  unit: string;
}

export interface PantryItem {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit: string;
  added_at: string;
  expires_at?: string | null;
}

export interface RecipeSuggestion {
  id: string;
  title: string;
  thumbnail: string;
  source_url: string;
  prep_time_minutes?: number;
  match_score?: number;
}

export interface TodayNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  goal_calories: number;
  meals: Array<{
    id: string;
    name: string;
    calories: number;
    logged_at: string;
  }>;
}

export interface GamificationSummary {
  streak_days: number;
  points: number;
  next_reward_points: number;
  next_reward_name: string;
}

export function parseText(text: string): ParsedItem[] {
  // Simple parser: looks for patterns like "2kg onion", "500g rice", "dozen eggs"
  const items: ParsedItem[] = [];
  const parts = text.split(/,\s*|\s+and\s+/i).filter(Boolean);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Match patterns like "2kg", "500g", "2 lbs", "1 dozen"
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(kg|g|lbs?|oz|dozen)?\s+(.+)$/i);
    if (match) {
      let qty = parseFloat(match[1]);
      let unit = (match[2] || 'unit').toLowerCase();
      let name = match[3].trim();

      // Handle "dozen" as 12
      if (unit === 'dozen') {
        qty *= 12;
        unit = 'unit';
      }

      // Capitalize name
      name = name.charAt(0).toUpperCase() + name.slice(1);

      items.push({ name, quantity: qty, unit });
    } else {
      // Fallback: treat whole thing as item name with quantity 1
      const name = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      items.push({ name, quantity: 1, unit: 'unit' });
    }
  }

  return items;
}

export class ApiClient {
  private baseUrl: string;

  constructor(options: { baseUrl: string }) {
    this.baseUrl = options.baseUrl;
  }

  async addGroceries(payload: { text: string }): Promise<void> {
    await fetch(`${this.baseUrl}/pantry/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async listPantry(): Promise<PantryItem[]> {
    const res = await fetch(`${this.baseUrl}/pantry/items`);
    const data = await res.json();
    return data.items || [];
  }

  async suggestRecipes(params: {
    ingredients: string[];
    max_time?: number;
    limit?: number;
  }): Promise<RecipeSuggestion[]> {
    const url = new URL(`${this.baseUrl}/recipe/suggest`);
    params.ingredients.forEach((ing) => url.searchParams.append('ingredients[]', ing));
    if (params.max_time) url.searchParams.set('max_time', String(params.max_time));
    if (params.limit) url.searchParams.set('limit', String(params.limit));

    const res = await fetch(url.toString());
    const data = await res.json();
    return data.recipes || [];
  }

  async today(): Promise<TodayNutrition> {
    const res = await fetch(`${this.baseUrl}/nutrition/today`);
    return res.json();
  }

  async summary(): Promise<GamificationSummary> {
    const res = await fetch(`${this.baseUrl}/gamification/summary`);
    return res.json();
  }

  async sendEvent(action: string): Promise<void> {
    await fetch(`${this.baseUrl}/gamification/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
  }

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const res = await fetch(`${this.baseUrl}/pantry/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }

    const data = await res.json();
    return data.text || '';
  }
}
