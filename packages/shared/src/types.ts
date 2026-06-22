// Shared types mirroring the Go backend's JSON shapes. Keep these in sync with
// backend/internal/*/{store,handler}.go and recipeprovider/provider.go.

export interface ParsedItem {
  raw_text: string;
  name: string;
  normalized_name: string;
  quantity: number;
  unit: string;
  category: string;
  shelf_life_days: number;
  expires_at?: string;
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
  expires_at?: string;
}

export interface Ingredient {
  name: string;
  measure?: string;
}

export interface Recipe {
  id: string;
  title: string;
  image: string;
  category: string;
  area: string;
  instructions: string;
  ingredients: Ingredient[];
  time_minutes: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source_url?: string;
}

export interface RecipeSuggestion extends Recipe {
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

export interface MealLog {
  id: string;
  user_id: string;
  source: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  cooked_at: string;
}

export interface TodayNutrition {
  goal: NutritionGoal;
  totals: NutritionTotals;
  calories_remaining: number;
  meals: MealLog[];
}

export interface Streak {
  current_streak: number;
  longest_streak: number;
  last_active?: string;
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

export interface ShareStory {
  share_text: string;
  meals_cooked: number;
  current_streak: number;
  total_points: number;
}

export type GameAction =
  | 'log_pantry'
  | 'cook_meal'
  | 'hit_goal'
  | 'avoid_waste'
  | 'share'
  | 'refer';
