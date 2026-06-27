'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { SavedReel } from '@nuskhaa/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const PLATFORM_EMOJI: Record<SavedReel['platform'], string> = {
  instagram: '📸',
  youtube: '▶️',
  tiktok: '🎵',
  unknown: '🔗',
};

export default function ReelsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [reels, setReels] = useState<SavedReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [addedToList, setAddedToList] = useState<Record<string, boolean>>({});

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listReels()
      .then((d) => setReels(d.reels))
      .catch(() => setReels([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function handleImport() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setImporting(true);
    setImportError(null);
    try {
      const reel = await api.importReel({ url: trimmed });
      setReels((prev) => [reel, ...prev]);
      setUrlInput('');
    } catch (e) {
      setImportError((e as Error).message ?? 'Failed to import reel');
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await api.deleteReel(id);
      setReels((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  async function handleAddToShopping(reel: SavedReel) {
    try {
      await api.addShoppingItems(
        reel.ingredients.map((i) => ({
          ingredient_name: i.name,
          quantity: i.measure || '',
        }))
      );
      setAddedToList((prev) => ({ ...prev, [reel.id]: true }));
    } catch {
      // silently ignore
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
          <h1 className="text-xl font-bold">Saved Reels</h1>
        </div>

        {/* Import input */}
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
              placeholder="Paste Instagram, YouTube or TikTok URL"
              className="flex-1 rounded-xl bg-white/20 px-3 py-2.5 text-sm text-white placeholder-white/60 outline-none focus:bg-white/30"
            />
            <button
              onClick={handleImport}
              disabled={importing || !urlInput.trim()}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-white/90 disabled:opacity-50"
            >
              {importing ? '…' : 'Import'}
            </button>
          </div>
          {importError && (
            <p className="text-xs text-red-200">{importError}</p>
          )}
        </div>
      </div>

      <div className="p-4">
        {loading && (
          <p className="py-16 text-center text-slate-400">Loading saved reels…</p>
        )}

        {!loading && reels.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-4xl">🎬</p>
            <p className="mt-3 text-slate-500">No saved reels yet.</p>
            <p className="mt-1 text-sm text-slate-400">
              Paste a link above to save a recipe.
            </p>
          </div>
        )}

        {!loading && reels.length > 0 && (
          <div className="space-y-3">
            {reels.map((reel) => (
              <div key={reel.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{PLATFORM_EMOJI[reel.platform]}</span>
                      <p className="truncate font-semibold text-slate-800">{reel.title || reel.raw_title}</p>
                    </div>
                    <a
                      href={reel.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-xs text-brand hover:underline"
                    >
                      {reel.source_url}
                    </a>
                    <p className="mt-1 text-xs text-slate-400">
                      {reel.ingredients.length} ingredient{reel.ingredients.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(reel.id)}
                    disabled={deleting === reel.id}
                    className="shrink-0 text-slate-300 transition hover:text-red-400 disabled:opacity-50"
                    aria-label="Delete reel"
                  >
                    {deleting === reel.id ? '…' : '🗑️'}
                  </button>
                </div>

                {/* Add to shopping list */}
                {reel.ingredients.length > 0 && (
                  <button
                    onClick={() => handleAddToShopping(reel)}
                    disabled={addedToList[reel.id]}
                    className={`mt-3 w-full rounded-xl py-2 text-sm font-medium transition ${
                      addedToList[reel.id]
                        ? 'bg-green-100 text-green-700'
                        : 'bg-brand text-white hover:bg-brand-dark disabled:opacity-60'
                    }`}
                  >
                    {addedToList[reel.id] ? 'Added to shopping list ✓' : '🛒 Add all to Shopping List'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
