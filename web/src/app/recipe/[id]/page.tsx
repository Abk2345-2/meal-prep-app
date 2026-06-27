'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { RecipeSuggestion } from '@nuskhaa/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { parseInstructionSteps } from '@/lib/parseSteps';

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<RecipeSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cooking, setCooking] = useState(false);
  const [cooked, setCooked] = useState(false);

  // Favorite state
  const [favorited, setFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // Share state
  const [sharing, setSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Shopping list state
  const [addingToList, setAddingToList] = useState(false);
  const [addedToList, setAddedToList] = useState(false);

  useEffect(() => {
    api
      .getRecipe(id)
      .then(setRecipe)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  // Check if already favorited
  useEffect(() => {
    if (!user || !id) return;
    api
      .listFavorites()
      .then((d) => {
        const isFav = d.favorites.some((f) => f.recipe_id === id);
        setFavorited(isFav);
      })
      .catch(() => {});
  }, [user, id]);

  async function logCooked() {
    if (!recipe || cooked) return;
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
      setCooked(true);
    } finally {
      setCooking(false);
    }
  }

  async function toggleFavorite() {
    if (!recipe || favLoading) return;
    setFavLoading(true);
    try {
      if (favorited) {
        await api.removeFavorite(recipe.id);
        setFavorited(false);
      } else {
        await api.addFavorite(recipe.id, recipe);
        setFavorited(true);
      }
    } finally {
      setFavLoading(false);
    }
  }

  async function handleShare() {
    if (!recipe || sharing) return;
    setSharing(true);
    try {
      const shared = await api.createShare(recipe.id, recipe);
      const shareUrl = `${window.location.origin}/shared/${shared.token}`;
      if (navigator.share) {
        await navigator.share({ title: recipe.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      }
    } finally {
      setSharing(false);
    }
  }

  async function addToShoppingList() {
    if (!recipe || addingToList) return;
    setAddingToList(true);
    try {
      await api.addShoppingItems(
        recipe.ingredients.map((i) => ({
          ingredient_name: i.name,
          quantity: i.measure || '',
          from_recipe_id: recipe.id,
        }))
      );
      setAddedToList(true);
    } finally {
      setAddingToList(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="py-16 text-center text-slate-400">Loading recipe…</p>
      </main>
    );
  }

  if (error || !recipe) {
    return (
      <main className="mx-auto max-w-md p-4">
        <button onClick={() => router.back()} className="mb-4 text-sm text-brand">
          ← Back
        </button>
        <p className="rounded-xl bg-red-50 p-4 text-red-500">{error ?? 'Recipe not found'}</p>
      </main>
    );
  }

  const steps = parseInstructionSteps(recipe.instructions);

  const youtubeId = recipe.youtube_url
    ? (() => {
        try { return new URL(recipe.youtube_url).searchParams.get('v'); }
        catch { return null; }
      })()
    : null;

  // match_score is only present when arriving from suggest — hide it on direct lookup
  const hasMatchScore = typeof recipe.match_score === 'number' && !isNaN(recipe.match_score);

  return (
    <main className="mx-auto max-w-md pb-12">
      {/* Hero image */}
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={recipe.image} alt={recipe.title} className="h-56 w-full object-cover" />
        <button
          onClick={() => router.back()}
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
          aria-label="Go back"
        >
          ←
        </button>
      </div>

      <div className="space-y-5 p-4">
        {/* Title + meta */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{recipe.title}</h1>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
            <span>⏱️ {recipe.time_minutes} min</span>
            <span>🔥 {recipe.calories} cal</span>
            {recipe.area && <span>🌍 {recipe.area}</span>}
            {recipe.category && <span>🍴 {recipe.category}</span>}
            {hasMatchScore && (
              <span className="font-medium text-brand-dark">
                {Math.round(recipe.match_score * 100)}% match
              </span>
            )}
          </div>
        </div>

        {/* Nutrition pills */}
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

        {/* Log cooked + Favorite + Share */}
        <div className="flex gap-2">
          <button
            onClick={logCooked}
            disabled={cooking || cooked}
            className={`flex-1 rounded-xl py-3 text-base font-semibold transition ${
              cooked
                ? 'bg-green-100 text-green-700'
                : 'bg-brand text-white hover:bg-brand-dark disabled:opacity-60'
            }`}
          >
            {cooked
              ? `✓ Logged`
              : cooking
              ? 'Logging…'
              : `🍳 Cooked  ·  +${recipe.calories} cal`}
          </button>

          {/* Favorite */}
          {user && (
            <button
              onClick={toggleFavorite}
              disabled={favLoading}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              {favorited ? '❤️' : '🤍'}
            </button>
          )}

          {/* Share */}
          {user && (
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              aria-label="Share recipe"
              title={shareCopied ? 'Link copied!' : 'Share recipe'}
            >
              {shareCopied ? '✓' : '🔗'}
            </button>
          )}
        </div>

        {/* Ingredients */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">🛒 Ingredients</h2>
            {user && (
              <button
                onClick={addToShoppingList}
                disabled={addingToList || addedToList}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  addedToList
                    ? 'bg-green-100 text-green-700'
                    : 'bg-brand text-white hover:bg-brand-dark disabled:opacity-60'
                }`}
              >
                {addedToList
                  ? 'Added to shopping list ✓'
                  : addingToList
                  ? 'Adding…'
                  : '+ Shopping List'}
              </button>
            )}
          </div>
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

        {/* Steps */}
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

        {/* YouTube embed */}
        {youtubeId && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">▶️ Video</h2>
            <div className="overflow-hidden rounded-xl">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                title={`${recipe.title} video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-52 w-full"
              />
            </div>
          </section>
        )}

        {/* Source link */}
        {recipe.source_url && (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-slate-200 py-3 text-center text-sm font-medium text-brand"
          >
            View original recipe ↗
          </a>
        )}
      </div>
    </main>
  );
}
