'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  GamificationSummary,
  PantryItem,
  RecipeSuggestion,
  TodayNutrition,
} from '@pantrytoplate/shared';
import { api } from '@/lib/api';
import { AddGroceries } from '@/components/AddGroceries';
import { PantrySummary } from '@/components/PantrySummary';
import { RecipeStrip } from '@/components/RecipeStrip';
import { StatsHeader } from '@/components/StatsHeader';

export default function Home() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeSuggestion[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState(30);
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

  // Recompute recipe suggestions whenever pantry or selected time changes.
  const refreshRecipes = useCallback(
    async (pantry: PantryItem[], maxTime: number) => {
      const ingredients = pantry.map((i) => i.normalized_name);
      if (ingredients.length === 0) {
        setRecipes([]);
        return;
      }
      setRecipesLoading(true);
      try {
        const { recipes } = await api.suggestRecipes({
          ingredients,
          max_time: maxTime,
          limit: 8,
        });
        setRecipes(recipes);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setRecipesLoading(false);
      }
    },
    [],
  );

  // Initial load.
  useEffect(() => {
    (async () => {
      const pantry = await refreshPantry();
      await refreshRecipes(pantry, selectedTime);
      await refreshStats();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSaved = useCallback(async () => {
    const pantry = await refreshPantry();
    await refreshRecipes(pantry, selectedTime);
    await refreshStats();
  }, [refreshPantry, refreshRecipes, refreshStats, selectedTime]);

  const onSelectTime = useCallback(
    (t: number) => {
      setSelectedTime(t);
      refreshRecipes(items, t);
    },
    [items, refreshRecipes],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await api.deletePantryItem(id);
      const pantry = await refreshPantry();
      await refreshRecipes(pantry, selectedTime);
    },
    [refreshPantry, refreshRecipes, selectedTime],
  );

  const onShare = useCallback(async () => {
    try {
      const story = await api.story();
      if (navigator.share) {
        await navigator.share({ text: story.share_text });
      } else {
        await navigator.clipboard.writeText(story.share_text);
        alert('Copied to clipboard:\n\n' + story.share_text);
      }
      await api.sendEvent('share');
      await refreshStats();
    } catch {
      /* user cancelled share */
    }
  }, [refreshStats]);

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-12">
      <StatsHeader nutrition={nutrition} game={game} onShare={onShare} />
      <AddGroceries onSaved={onSaved} />
      <RecipeStrip
        recipes={recipes}
        loading={recipesLoading}
        selectedTime={selectedTime}
        onSelectTime={onSelectTime}
        onCooked={refreshStats}
      />
      <PantrySummary items={items} onDelete={onDelete} />

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-center text-sm text-red-500">
          {error}
        </p>
      )}
    </main>
  );
}
