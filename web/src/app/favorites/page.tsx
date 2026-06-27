'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Favorite } from '@nuskhaa/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function FavoritesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listFavorites()
      .then((d) => setFavorites(d.favorites))
      .catch(() => setFavorites([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function handleRemove(recipeId: string) {
    setRemoving(recipeId);
    try {
      await api.removeFavorite(recipeId);
      setFavorites((prev) => prev.filter((f) => f.recipe_id !== recipeId));
    } finally {
      setRemoving(null);
    }
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="py-16 text-center text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md pb-12">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand to-brand-dark p-5 text-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20"
          >
            ←
          </button>
          <h1 className="text-xl font-bold">Favorites</h1>
        </div>
      </div>

      <div className="p-4">
        {loading && (
          <p className="py-16 text-center text-slate-400">Loading favorites…</p>
        )}

        {!loading && favorites.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-4xl">❤️</p>
            <p className="mt-3 text-slate-500">No favorites yet.</p>
            <p className="mt-1 text-sm text-slate-400">
              Tap ❤️ on any recipe to save it here.
            </p>
          </div>
        )}

        {!loading && favorites.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {favorites.map((fav) => {
              const recipe = fav.recipe_data;
              const hasMatchScore =
                typeof recipe.match_score === 'number' &&
                !isNaN(recipe.match_score);

              return (
                <div
                  key={fav.id}
                  className="relative overflow-hidden rounded-2xl bg-white shadow-sm"
                >
                  {/* Unfavorite button */}
                  <button
                    onClick={() => handleRemove(fav.recipe_id)}
                    disabled={removing === fav.recipe_id}
                    className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 disabled:opacity-50"
                    aria-label="Remove from favorites"
                  >
                    {removing === fav.recipe_id ? '…' : '✕'}
                  </button>

                  {/* Card — clickable */}
                  <button
                    className="w-full text-left"
                    onClick={() => router.push(`/recipe/${fav.recipe_id}`)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={recipe.image}
                      alt={recipe.title}
                      className="h-32 w-full object-cover"
                    />
                    <div className="p-2.5">
                      <p className="line-clamp-2 text-sm font-semibold text-slate-800">
                        {recipe.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span>⏱️ {recipe.time_minutes} min</span>
                        {hasMatchScore && (
                          <span className="font-medium text-brand">
                            {Math.round(recipe.match_score * 100)}% match
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
