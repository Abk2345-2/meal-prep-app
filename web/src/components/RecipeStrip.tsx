'use client';

import { useState } from 'react';
import type { RecipeSuggestion } from '@pantrytoplate/shared';
import { api } from '@/lib/api';

const TIME_OPTIONS = [15, 30, 60];

export function RecipeStrip({
  recipes,
  loading,
  selectedTime,
  onSelectTime,
  onCooked,
}: {
  recipes: RecipeSuggestion[];
  loading: boolean;
  selectedTime: number;
  onSelectTime: (t: number) => void;
  onCooked: () => void;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">🍽️ Suggested for you</h2>
        <div className="flex gap-1">
          {TIME_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => onSelectTime(t)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                selectedTime === t ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t} min
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="py-6 text-center text-sm text-slate-400">Finding recipes…</p>}

      {!loading && recipes.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">
          Add a few groceries and we&apos;ll suggest meals you can make.
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-1">
        {recipes.map((r) => (
          <RecipeCard key={r.id} recipe={r} onCooked={onCooked} />
        ))}
      </div>
    </section>
  );
}

function RecipeCard({ recipe, onCooked }: { recipe: RecipeSuggestion; onCooked: () => void }) {
  const [cooking, setCooking] = useState(false);
  const [done, setDone] = useState(false);

  async function cook() {
    setCooking(true);
    try {
      await api.logMeal({
        source: recipe.title,
        calories: recipe.calories,
        protein_g: recipe.protein_g,
        carbs_g: recipe.carbs_g,
        fat_g: recipe.fat_g,
      });
      await api.sendEvent('cook_meal');
      setDone(true);
      onCooked();
    } finally {
      setCooking(false);
    }
  }

  return (
    <div className="w-56 shrink-0 overflow-hidden rounded-xl border border-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={recipe.image} alt={recipe.title} className="h-32 w-full object-cover" />
      <div className="p-3">
        <p className="line-clamp-2 h-10 text-sm font-semibold">{recipe.title}</p>
        <p className="mt-1 text-xs text-slate-500">
          ⏱️ {recipe.time_minutes} min · {recipe.calories} cal ·{' '}
          <span className="font-medium text-brand-dark">
            {Math.round(recipe.match_score * 100)}% match
          </span>
        </p>
        {recipe.missing_ingredients.length > 0 && (
          <p className="mt-1 line-clamp-1 text-xs text-slate-400">
            Need: {recipe.missing_ingredients.slice(0, 3).join(', ')}
          </p>
        )}
        <button
          onClick={cook}
          disabled={cooking || done}
          className="mt-2 w-full rounded-lg bg-brand py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {done ? '✓ Cooked' : cooking ? 'Logging…' : 'Cook now'}
        </button>
      </div>
    </div>
  );
}
