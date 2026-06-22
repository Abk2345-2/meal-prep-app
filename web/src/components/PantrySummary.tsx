'use client';

import { useMemo } from 'react';
import type { PantryItem } from '@pantrytoplate/shared';

// Categorize each item into the spec's color bands by days-until-expiry.
function expiryBand(item: PantryItem): 'fresh' | 'soon' | 'expired' {
  if (!item.expires_at) return 'fresh';
  const days = (new Date(item.expires_at).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 'expired';
  if (days <= 2) return 'soon';
  return 'fresh';
}

export function PantrySummary({
  items,
  onDelete,
}: {
  items: PantryItem[];
  onDelete: (id: string) => void;
}) {
  const bands = useMemo(() => {
    const groups = { fresh: [] as PantryItem[], soon: [] as PantryItem[], expired: [] as PantryItem[] };
    for (const it of items) groups[expiryBand(it)].push(it);
    return groups;
  }, [items]);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">🟢 Your Pantry</h2>
        <span className="text-sm text-slate-400">{items.length} items</span>
      </div>

      {items.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">
          Nothing yet — add groceries above to get started.
        </p>
      )}

      {bands.soon.length > 0 && (
        <Band title="🟡 Expiring soon" items={bands.soon} tone="soon" onDelete={onDelete} />
      )}
      {bands.expired.length > 0 && (
        <Band title="🔴 Expired" items={bands.expired} tone="expired" onDelete={onDelete} />
      )}
      {bands.fresh.length > 0 && (
        <Band title="🟢 In stock" items={bands.fresh} tone="fresh" onDelete={onDelete} />
      )}
    </section>
  );
}

const toneStyles = {
  fresh: 'border-l-4 border-brand bg-brand-light/40',
  soon: 'border-l-4 border-amber-400 bg-amber-50',
  expired: 'border-l-4 border-red-400 bg-red-50',
};

function Band({
  title,
  items,
  tone,
  onDelete,
}: {
  title: string;
  items: PantryItem[];
  tone: keyof typeof toneStyles;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-sm font-medium text-slate-500">{title}</p>
      <ul className="space-y-1">
        {items.map((it) => (
          <li
            key={it.id}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${toneStyles[tone]}`}
          >
            <span>
              <span className="font-medium">{it.name}</span>{' '}
              <span className="text-slate-500">
                {it.quantity} {it.unit !== 'unit' ? it.unit : ''}
              </span>
            </span>
            <div className="flex items-center gap-3">
              {it.expires_at && (
                <span className="text-xs text-slate-400">
                  {daysLabel(it.expires_at)}
                </span>
              )}
              <button
                onClick={() => onDelete(it.id)}
                className="text-slate-300 hover:text-red-400"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function daysLabel(expiresAt: string): string {
  const days = Math.round((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}
