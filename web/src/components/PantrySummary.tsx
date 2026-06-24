'use client';

import { useMemo, useState } from 'react';
import type { PantryItem } from '@pantrytoplate/shared';

const TABS = [
  { key: 'all',      label: 'All' },
  { key: 'meat',     label: '🥩 Meat' },
  { key: 'dairy',    label: '🥛 Dairy' },
  { key: 'veggies',  label: '🥦 Vegetables' },
  { key: 'fruits',   label: '🍎 Fruits' },
  { key: 'spices',   label: '🌶 Spices' },
  { key: 'grain',    label: '🌾 Grains' },
  { key: 'frozen',   label: '🧊 Frozen' },
  { key: 'pantry',   label: '🫙 Pantry' },
] as const;

type TabKey = typeof TABS[number]['key'];

function expiryBand(item: PantryItem): 'frozen' | 'fresh' | 'soon' | 'expired' {
  // Frozen items never expire — show with a special band
  if (item.category === 'frozen') return 'frozen';
  if (!item.expires_at) return 'fresh';
  const days = (new Date(item.expires_at).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 'expired';
  if (days <= 2) return 'soon';
  return 'fresh';
}

function daysLabel(expiresAt: string): string {
  const days = Math.round((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days === 0) return 'expires today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

const bandStyles = {
  frozen:  'border-l-4 border-sky-400 bg-sky-50',
  fresh:   'border-l-4 border-brand bg-brand-light/40',
  soon:    'border-l-4 border-amber-400 bg-amber-50',
  expired: 'border-l-4 border-red-400 bg-red-50',
};

export function PantrySummary({ items, onDelete }: { items: PantryItem[]; onDelete: (id: string) => void }) {
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const filtered = useMemo(() => {
    if (activeTab === 'all') return items;
    // seafood + other fall under meat tab
    if (activeTab === 'meat') return items.filter((i) => i.category === 'meat' || i.category === 'seafood');
    // veggies tab also catches uncategorised produce
    if (activeTab === 'veggies') return items.filter((i) => i.category === 'veggies' || i.category === 'other');
    return items.filter((i) => i.category === activeTab);
  }, [items, activeTab]);

  // Only show tabs that have items (+ All)
  const visibleTabs = TABS.filter((t) => {
    if (t.key === 'all') return true;
    if (t.key === 'meat') return items.some((i) => i.category === 'meat' || i.category === 'seafood');
    if (t.key === 'veggies') return items.some((i) => i.category === 'veggies' || i.category === 'other');
    return items.some((i) => i.category === t.key);
  });

  // Within the filtered set, split by expiry band
  const bands = useMemo(() => {
    const g = { frozen: [] as PantryItem[], soon: [] as PantryItem[], expired: [] as PantryItem[], fresh: [] as PantryItem[] };
    for (const it of filtered) g[expiryBand(it)].push(it);
    return g;
  }, [filtered]);

  return (
    <section className="rounded-2xl bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-lg font-semibold">🟢 Your Pantry</h2>
        <span className="text-sm text-slate-400">{items.length} items</span>
      </div>

      {/* Category tabs — horizontal scroll */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition ${
              activeTab === t.key ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 pt-2">
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">Nothing yet — add groceries above to get started.</p>
        )}

        {filtered.length === 0 && items.length > 0 && (
          <p className="py-4 text-center text-sm text-slate-400">No {activeTab} items in pantry.</p>
        )}

        {bands.expired.length > 0 && <Band title="🔴 Expired" items={bands.expired} band="expired" onDelete={onDelete} />}
        {bands.soon.length > 0    && <Band title="🟡 Expiring soon" items={bands.soon}    band="soon"    onDelete={onDelete} />}
        {bands.frozen.length > 0  && <Band title="🧊 Frozen" items={bands.frozen}  band="frozen"  onDelete={onDelete} />}
        {bands.fresh.length > 0   && <Band title="🟢 In stock" items={bands.fresh}   band="fresh"   onDelete={onDelete} />}
      </div>
    </section>
  );
}

function Band({
  title, items, band, onDelete,
}: {
  title: string; items: PantryItem[]; band: keyof typeof bandStyles; onDelete: (id: string) => void;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-sm font-medium text-slate-500">{title}</p>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${bandStyles[band]}`}>
            <span>
              <span className="font-medium">{it.name}</span>{' '}
              <span className="text-slate-500">{it.quantity}{it.unit !== 'unit' ? ` ${it.unit}` : ''}</span>
            </span>
            <div className="flex items-center gap-3">
              {band === 'frozen' && <span className="text-xs text-sky-400">No expiry</span>}
              {it.expires_at && band !== 'frozen' && (
                <span className="text-xs text-slate-400">{daysLabel(it.expires_at)}</span>
              )}
              <button onClick={() => onDelete(it.id)} className="text-slate-300 hover:text-red-400" aria-label="Remove">✕</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
