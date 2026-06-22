import { useCallback, useEffect, useState } from 'react';
import type {
  GamificationSummary,
  PantryItem,
  RecipeSuggestion,
  TodayNutrition,
} from '@pantrytoplate/shared';
import { api } from './api';

// useAppData centralizes the screens' shared state so the tabs stay in sync after
// adding groceries, cooking a meal, or deleting an item.
export function useAppData() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeSuggestion[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [maxTime, setMaxTime] = useState(30);
  const [nutrition, setNutrition] = useState<TodayNutrition | null>(null);
  const [game, setGame] = useState<GamificationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      const [n, g] = await Promise.all([api.today(), api.summary()]);
      setNutrition(n);
      setGame(g);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const refreshRecipes = useCallback(async (pantry: PantryItem[], time: number) => {
    const ingredients = pantry.map((i) => i.normalized_name);
    if (ingredients.length === 0) {
      setRecipes([]);
      return;
    }
    setRecipesLoading(true);
    try {
      const { recipes } = await api.suggestRecipes({ ingredients, max_time: time, limit: 8 });
      setRecipes(recipes);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRecipesLoading(false);
    }
  }, []);

  const refreshPantry = useCallback(async () => {
    try {
      const { items } = await api.listPantry();
      setItems(items);
      return items;
    } catch (e) {
      setError((e as Error).message);
      return [];
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const pantry = await refreshPantry();
    await refreshRecipes(pantry, maxTime);
    await refreshStats();
  }, [refreshPantry, refreshRecipes, refreshStats, maxTime]);

  const selectTime = useCallback(
    (t: number) => {
      setMaxTime(t);
      refreshRecipes(items, t);
    },
    [items, refreshRecipes],
  );

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    items,
    recipes,
    recipesLoading,
    maxTime,
    nutrition,
    game,
    error,
    refreshAll,
    refreshPantry,
    refreshStats,
    selectTime,
  };
}
