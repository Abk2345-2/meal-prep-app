// Typed API client for the PantryToPlate gateway. Works in both the browser
// (Next.js) and React Native (Expo) — it only depends on fetch.

import type {
  GameAction,
  GamificationSummary,
  NutritionGoal,
  ParsedItem,
  PantryItem,
  Recipe,
  RecipeSuggestion,
  Reward,
  ShareStory,
  TodayNutrition,
} from './types';

export interface ClientOptions {
  /** Gateway base URL, e.g. http://localhost:8080 */
  baseUrl: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        message = body?.error?.message ?? message;
      } catch {
        /* ignore non-JSON error bodies */
      }
      throw new Error(message);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // ---- Pantry ----
  parse(text: string): Promise<{ items: ParsedItem[] }> {
    return this.request('/api/pantry/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  addGroceries(payload: { text?: string; items?: ParsedItem[] }): Promise<{ items: PantryItem[] }> {
    return this.request('/api/pantry/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  listPantry(status?: 'expiring'): Promise<{ items: PantryItem[] }> {
    const q = status ? `?status=${status}` : '';
    return this.request(`/api/pantry/items${q}`);
  }

  deletePantryItem(id: string): Promise<void> {
    return this.request(`/api/pantry/items/${id}`, { method: 'DELETE' });
  }

  // ---- Recipes ----
  suggestRecipes(params: {
    ingredients: string[];
    max_time?: number;
    min_match?: number;
    limit?: number;
  }): Promise<{ recipes: RecipeSuggestion[] }> {
    return this.request('/api/recipes/suggest', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  getRecipe(id: string): Promise<Recipe> {
    return this.request(`/api/recipes/${id}`);
  }

  // ---- Nutrition ----
  getGoal(): Promise<NutritionGoal> {
    return this.request('/api/nutrition/goal');
  }

  setGoal(goal: Omit<NutritionGoal, 'user_id'>): Promise<NutritionGoal> {
    return this.request('/api/nutrition/goal', {
      method: 'PUT',
      body: JSON.stringify(goal),
    });
  }

  logMeal(meal: {
    source: string;
    calories: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  }): Promise<{ today: TodayNutrition['totals'] }> {
    return this.request('/api/nutrition/log', {
      method: 'POST',
      body: JSON.stringify(meal),
    });
  }

  today(): Promise<TodayNutrition> {
    return this.request('/api/nutrition/today');
  }

  // ---- Gamification ----
  summary(): Promise<GamificationSummary> {
    return this.request('/api/gamification/summary');
  }

  sendEvent(action: GameAction): Promise<{ points_awarded: number; total_points: number }> {
    return this.request('/api/gamification/event', {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  rewards(): Promise<{ rewards: Reward[] }> {
    return this.request('/api/gamification/rewards');
  }

  story(): Promise<ShareStory> {
    return this.request('/api/gamification/story');
  }
}
