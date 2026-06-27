import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GamificationSummary,
  PantryItem,
  RecipeSuggestion,
  TodayNutrition,
} from '@nuskhaa/shared';
import { api } from './api';
import { useAuth } from './auth-context';

// useAppData centralizes the screens' shared state so the tabs stay in sync after
// adding groceries, cooking a meal, or deleting an item.
export function useAppData() {
  const { user } = useAuth();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeSuggestion[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);

  // Filter state — mirrors web (selectedTime is the "value" key, min/maxTime sent to API)
  const [selectedTime, setSelectedTime] = useState(15);
  const [minTime, setMinTime] = useState(0);
  const [maxTime, setMaxTime] = useState(15);
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [nutrition, setNutrition] = useState<TodayNutrition | null>(null);
  const [game, setGame] = useState<GamificationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  const refreshStats = useCallback(async () => {
    try {
      const [n, g] = await Promise.all([api.today(), api.summary()]);
      setNutrition(n);
      setGame(g);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Immediately apply a meal to local nutrition state so the UI updates
  // without waiting for the server round-trip.
  const optimisticAddMeal = useCallback((cal: number, protein: number, carbs: number, fat: number) => {
    setNutrition((prev) => {
      if (!prev) return prev;
      const totals = {
        calories:  prev.totals.calories  + cal,
        protein_g: prev.totals.protein_g + protein,
        carbs_g:   prev.totals.carbs_g   + carbs,
        fat_g:     prev.totals.fat_g     + fat,
        meals:     prev.totals.meals     + 1,
      };
      return {
        ...prev,
        totals,
        calories_remaining: Math.max(0, prev.goal.daily_calories - totals.calories),
      };
    });
  }, []);

  const optimisticRemoveMeal = useCallback((cal: number, protein: number, carbs: number, fat: number) => {
    setNutrition((prev) => {
      if (!prev) return prev;
      const totals = {
        calories:  Math.max(0, prev.totals.calories  - cal),
        protein_g: Math.max(0, prev.totals.protein_g - protein),
        carbs_g:   Math.max(0, prev.totals.carbs_g   - carbs),
        fat_g:     Math.max(0, prev.totals.fat_g     - fat),
        meals:     Math.max(0, prev.totals.meals     - 1),
      };
      return {
        ...prev,
        totals,
        calories_remaining: Math.max(0, prev.goal.daily_calories - totals.calories),
      };
    });
  }, []);

  const refreshRecipes = useCallback(
    async (
      pantry: PantryItem[],
      _minTime: number,
      _maxTime: number,
      area: string,
      category: string,
    ) => {
      const ingredients = pantry.map((i) => i.normalized_name);
      if (ingredients.length === 0) {
        setRecipes([]);
        return;
      }
      setRecipesLoading(true);
      try {
        const params: Parameters<typeof api.suggestRecipes>[0] = {
          ingredients,
          min_time: _minTime,
          area,
          category,
          limit: 8,
        };
        // maxTime = 0 means "no upper limit" (the 2hr+ tab)
        if (_maxTime > 0) params.max_time = _maxTime;
        const { recipes } = await api.suggestRecipes(params);
        setRecipes(recipes);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setRecipesLoading(false);
      }
    },
    [],
  );

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
    // Only show the skeleton on the very first load, not on mutations
    const isFirst = !initialLoadDone.current;
    if (isFirst) setLoading(true);
    try {
      const pantry = await refreshPantry();
      await Promise.all([
        refreshRecipes(pantry, minTime, maxTime, selectedArea, selectedCategory),
        refreshStats(),
      ]);
    } finally {
      if (isFirst) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }
  }, [refreshPantry, refreshRecipes, refreshStats, minTime, maxTime, selectedArea, selectedCategory]);

  // selectFilters — called when the filter drawer is applied
  const selectFilters = useCallback(
    (value: number, _minTime: number, _maxTime: number, area: string, category: string) => {
      setSelectedTime(value);
      setMinTime(_minTime);
      setMaxTime(_maxTime);
      setSelectedArea(area);
      setSelectedCategory(category);
      // Refresh recipes immediately with the new filter values (items is captured from closure)
      refreshPantry().then((pantry) => {
        refreshRecipes(pantry, _minTime, _maxTime, area, category);
      });
    },
    [refreshPantry, refreshRecipes],
  );

  // Wait for auth to resolve before fetching — ensures api token is set
  useEffect(() => {
    if (!user) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return {
    items,
    recipes,
    recipesLoading,
    selectedTime,
    selectedArea,
    selectedCategory,
    nutrition,
    game,
    error,
    loading,
    refreshAll,
    refreshPantry,
    refreshStats,
    selectFilters,
    optimisticAddMeal,
    optimisticRemoveMeal,
  };
}
