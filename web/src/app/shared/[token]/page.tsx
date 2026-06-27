'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { SharedRecipe } from '@nuskhaa/shared';
import { api } from '@/lib/api';
import { parseInstructionSteps } from '@/lib/parseSteps';

export default function SharedRecipePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [data, setData] = useState<SharedRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getShare(token)
      .then(setData)
      .catch(() => setError('This link has expired or does not exist.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="py-16 text-center text-slate-400">Loading recipe…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="text-4xl">🔗</p>
        <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-500">
          {error ?? 'This link has expired or does not exist.'}
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Open Nuskhaa
        </button>
      </main>
    );
  }

  const recipe = data.recipe_data;
  const steps = parseInstructionSteps(recipe.instructions);

  return (
    <main className="mx-auto max-w-md pb-12">
      {/* Hero */}
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={recipe.image}
          alt={recipe.title}
          className="h-56 w-full object-cover"
        />
        {/* Nuskhaa badge */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-white backdrop-blur">
          <span className="text-sm font-bold text-brand-light">Nuskhaa</span>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {/* Title + meta */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{recipe.title}</h1>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
            {recipe.time_minutes > 0 && <span>⏱️ {recipe.time_minutes} min</span>}
            {recipe.calories > 0 && <span>🔥 {recipe.calories} cal</span>}
            {recipe.area && <span>🌍 {recipe.area}</span>}
            {recipe.category && <span>🍴 {recipe.category}</span>}
          </div>
        </div>

        {/* Nutrition pills */}
        {(recipe.protein_g > 0 || recipe.carbs_g > 0 || recipe.fat_g > 0) && (
          <div className="flex gap-2">
            {[
              { label: 'Protein', value: recipe.protein_g, unit: 'g' },
              { label: 'Carbs', value: recipe.carbs_g, unit: 'g' },
              { label: 'Fat', value: recipe.fat_g, unit: 'g' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="flex-1 rounded-xl bg-slate-100 py-2 text-center text-xs">
                <p className="font-semibold text-slate-800">{value}{unit}</p>
                <p className="text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Open in Nuskhaa CTA */}
        <a
          href={`/recipe/${data.recipe_id}`}
          className="block w-full rounded-xl bg-brand py-3 text-center text-base font-semibold text-white hover:bg-brand-dark"
        >
          Open in Nuskhaa
        </a>

        {/* Ingredients */}
        {recipe.ingredients.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">🛒 Ingredients</h2>
            <ul className="space-y-1">
              {recipe.ingredients.map((ing, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between rounded-lg px-3 py-2 text-sm odd:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">{ing.name}</span>
                  <span className="text-slate-500">{ing.measure}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Steps */}
        {steps.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">👨‍🍳 Instructions</h2>
            <ol className="space-y-4">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-slate-700">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Footer CTA */}
        <div className="rounded-2xl bg-brand-light p-4 text-center">
          <p className="text-sm font-semibold text-brand-dark">Want to cook this?</p>
          <p className="mt-1 text-xs text-brand-dark/70">
            Sign in to Nuskhaa to track nutrition, build your pantry & more.
          </p>
          <a
            href="/login"
            className="mt-3 inline-block rounded-xl bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Get started — it&apos;s free
          </a>
        </div>
      </div>
    </main>
  );
}
