'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ShoppingItem } from '@nuskhaa/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function ShoppingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listShoppingItems()
      .then((d) => setItems(d.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function handleToggle(id: string) {
    setToggling(id);
    try {
      await api.toggleShoppingItem(id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, checked: !item.checked } : item
        )
      );
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await api.deleteShoppingItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  async function handleClearChecked() {
    setClearing(true);
    try {
      await api.clearCheckedItems();
      setItems((prev) => prev.filter((item) => !item.checked));
    } finally {
      setClearing(false);
    }
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="py-16 text-center text-slate-400">Loading…</p>
      </main>
    );
  }

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
  const hasChecked = checked.length > 0;

  return (
    <main className="mx-auto max-w-md pb-12">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand to-brand-dark p-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20"
            >
              ←
            </button>
            <h1 className="text-xl font-bold">Shopping List</h1>
          </div>

          {hasChecked && (
            <button
              onClick={handleClearChecked}
              disabled={clearing}
              className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium transition hover:bg-white/30 disabled:opacity-50"
            >
              {clearing ? 'Clearing…' : 'Clear checked'}
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {loading && (
          <p className="py-16 text-center text-slate-400">Loading shopping list…</p>
        )}

        {!loading && items.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-4xl">🛒</p>
            <p className="mt-3 text-slate-500">Your shopping list is empty.</p>
            <p className="mt-1 text-sm text-slate-400">
              Add ingredients from any recipe.
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-1">
            {/* Unchecked items */}
            {unchecked.map((item) => (
              <ShoppingRow
                key={item.id}
                item={item}
                toggling={toggling === item.id}
                deleting={deleting === item.id}
                onToggle={() => handleToggle(item.id)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}

            {/* Divider between unchecked and checked */}
            {unchecked.length > 0 && checked.length > 0 && (
              <div className="my-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">Checked</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            )}

            {/* Checked items */}
            {checked.map((item) => (
              <ShoppingRow
                key={item.id}
                item={item}
                toggling={toggling === item.id}
                deleting={deleting === item.id}
                onToggle={() => handleToggle(item.id)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ShoppingRow({
  item,
  toggling,
  deleting,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem;
  toggling: boolean;
  deleting: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
      {/* Checkbox */}
      <button
        onClick={onToggle}
        disabled={toggling}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
          item.checked
            ? 'border-brand bg-brand text-white'
            : 'border-slate-300 bg-white'
        } disabled:opacity-50`}
        aria-label={item.checked ? 'Uncheck item' : 'Check item'}
      >
        {item.checked && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Label */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            item.checked ? 'text-slate-400 line-through' : 'text-slate-800'
          }`}
        >
          {item.ingredient_name}
        </p>
        {item.quantity && (
          <p className={`text-xs ${item.checked ? 'text-slate-300' : 'text-slate-400'}`}>
            {item.quantity}
          </p>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={deleting}
        className="shrink-0 text-slate-300 transition hover:text-red-400 disabled:opacity-50"
        aria-label="Delete item"
      >
        {deleting ? '…' : '🗑️'}
      </button>
    </div>
  );
}
