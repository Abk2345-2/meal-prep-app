'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  GamificationSummary,
  PantryItem,
  RecipeSuggestion,
  TodayNutrition,
} from '@nuskhaa/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AddGroceries } from '@/components/AddGroceries';
import { PantrySummary } from '@/components/PantrySummary';
import { RecipeStrip } from '@/components/RecipeStrip';
import { StatsHeader } from '@/components/StatsHeader';

// Read a value from sessionStorage; returns the fallback if not found or SSR.
function readSession<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeSession(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const DEFAULT_TIME = { value: 15, minTime: 0, maxTime: 15 };

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect to /login once auth state is resolved and no user is present.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const [items, setItems] = useState<PantryItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeSuggestion[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  // Restore filter state from sessionStorage so it survives navigating to recipe detail and back.
  const [timeFilter, setTimeFilter] = useState(() =>
    readSession('rf_time', DEFAULT_TIME)
  );
  const [selectedArea, setSelectedArea] = useState(() =>
    readSession<string>('rf_area', '')
  );
  const [selectedCategory, setSelectedCategory] = useState(() =>
    readSession<string>('rf_category', '')
  );
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

  const refreshRecipes = useCallback(
    async (
      pantry: PantryItem[],
      minTime: number,
      maxTime: number,
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
          min_time: minTime,
          area,
          category,
          limit: 8,
        };
        // maxTime = 0 means "no upper limit" (the 2hr+ tab)
        if (maxTime > 0) params.max_time = maxTime;
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

  // Wait for auth to resolve before fetching — ensures api.setToken() has been
  // called with the real token, so pantry/nutrition data belongs to this user.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const pantry = await refreshPantry();
      await refreshRecipes(pantry, timeFilter.minTime, timeFilter.maxTime, selectedArea, selectedCategory);
      await refreshStats();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const onSaved = useCallback(async () => {
    const pantry = await refreshPantry();
    await refreshRecipes(pantry, timeFilter.minTime, timeFilter.maxTime, selectedArea, selectedCategory);
    await refreshStats();
  }, [refreshPantry, refreshRecipes, refreshStats, timeFilter, selectedArea, selectedCategory]);

  const onSelectTime = useCallback(
    (value: number, minTime: number, maxTime: number) => {
      const tf = { value, minTime, maxTime };
      setTimeFilter(tf);
      writeSession('rf_time', tf);
      refreshRecipes(items, minTime, maxTime, selectedArea, selectedCategory);
    },
    [items, refreshRecipes, selectedArea, selectedCategory],
  );

  const onSelectArea = useCallback(
    (area: string) => {
      setSelectedArea(area);
      writeSession('rf_area', area);
      refreshRecipes(items, timeFilter.minTime, timeFilter.maxTime, area, selectedCategory);
    },
    [items, refreshRecipes, timeFilter, selectedCategory],
  );

  const onSelectCategory = useCallback(
    (category: string) => {
      setSelectedCategory(category);
      writeSession('rf_category', category);
      refreshRecipes(items, timeFilter.minTime, timeFilter.maxTime, selectedArea, category);
    },
    [items, refreshRecipes, timeFilter, selectedArea],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await api.deletePantryItem(id);
      const pantry = await refreshPantry();
      await refreshRecipes(pantry, timeFilter.minTime, timeFilter.maxTime, selectedArea, selectedCategory);
    },
    [refreshPantry, refreshRecipes, timeFilter, selectedArea, selectedCategory],
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

  // Single stable root element — server and client always render the same
  // outer <main> so React hydration never sees a mismatch.
  // While auth is resolving (or user is absent) we show a full-screen spinner
  // inside the same <main> instead of swapping to a different element.
  if (authLoading || !user) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-4 pb-12">
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-12">
      <StatsHeader nutrition={nutrition} game={game} onShare={onShare} />
      <AddGroceries onSaved={onSaved} />
      <RecipeStrip
        recipes={recipes}
        loading={recipesLoading}
        selectedTime={timeFilter.value}
        onSelectTime={onSelectTime}
        selectedArea={selectedArea}
        onSelectArea={onSelectArea}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
        onCooked={refreshStats}
      />
      {/* Today's meals */}
      {(nutrition?.meals?.length ?? 0) > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Today&apos;s meals</h2>
          <div className="divide-y divide-slate-100">
            {nutrition!.meals.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2">
                <div className="min-w-0 flex-1">
                  {/^[a-zA-Z0-9]+$/.test(m.source) ? (
                    <a
                      href={`/recipe/${m.source}`}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      {m.source}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-slate-700">{m.source}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    {m.calories} cal · P {m.protein_g}g · C {m.carbs_g}g · F {m.fat_g}g
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <PantrySummary items={items} onDelete={onDelete} />

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-center text-sm text-red-500">
          {error}
        </p>
      )}
    </main>
  );
}
