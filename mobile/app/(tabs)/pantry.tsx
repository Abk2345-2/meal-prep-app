import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PantryItem } from '@pantrytoplate/shared';
import { useAppData } from '../../lib/useAppData';
import { api } from '../../lib/api';

// ── types & constants ─────────────────────────────────────────────────────────

type Band = 'frozen' | 'fresh' | 'soon' | 'expired';

const TABS = [
  { key: 'all',     label: '🍽 All' },
  { key: 'meat',    label: '🥩 Meat' },
  { key: 'dairy',   label: '🥛 Dairy' },
  { key: 'veggies', label: '🥦 Veggies' },
  { key: 'fruits',  label: '🍎 Fruits' },
  { key: 'spices',  label: '🌶 Spices' },
  { key: 'grain',   label: '🌾 Grains' },
  { key: 'frozen',  label: '🧊 Frozen' },
  { key: 'pantry',  label: '🫙 Pantry' },
] as const;

type TabKey = typeof TABS[number]['key'];

const bandConfig: Record<Band, { bg: string; border: string; label: string; labelColor: string }> = {
  frozen:  { bg: '#f0f9ff', border: '#38bdf8', label: '🧊 Frozen',        labelColor: '#0369a1' },
  fresh:   { bg: '#f0fdf4', border: '#86efac', label: '🟢 In stock',      labelColor: '#15803d' },
  soon:    { bg: '#fffbeb', border: '#fcd34d', label: '🟡 Expiring soon', labelColor: '#92400e' },
  expired: { bg: '#fef2f2', border: '#fca5a5', label: '🔴 Expired',       labelColor: '#b91c1c' },
};

const brand = '#16a34a';

// ── helpers ───────────────────────────────────────────────────────────────────

function expiryBand(item: PantryItem): Band {
  // Frozen items never expire — match web behaviour exactly
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

function matchesTab(item: PantryItem, tab: TabKey): boolean {
  if (tab === 'all') return true;
  const cat = item.category ?? '';
  // Mirror the web's PantrySummary filtering logic exactly
  if (tab === 'meat')    return cat === 'meat' || cat === 'seafood';
  if (tab === 'veggies') return cat === 'veggies' || cat === 'other';
  return cat === tab;
}

function tabHasItems(items: PantryItem[], tab: TabKey): boolean {
  return items.some((i) => matchesTab(i, tab));
}

// ── PantryScreen ──────────────────────────────────────────────────────────────

export default function PantryScreen() {
  const { items, refreshAll } = useAppData();
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const filteredItems = useMemo(
    () => items.filter((i) => matchesTab(i, activeTab)),
    [items, activeTab],
  );

  // Only show tabs that have at least one item (All is always visible)
  const visibleTabs = useMemo(
    () => TABS.filter((t) => t.key === 'all' || tabHasItems(items, t.key)),
    [items],
  );

  const bands = useMemo(() => {
    const g: Record<Band, PantryItem[]> = { frozen: [], soon: [], expired: [], fresh: [] };
    for (const it of filteredItems) g[expiryBand(it)].push(it);
    return g;
  }, [filteredItems]);

  const onDelete = useCallback(
    async (id: string) => {
      await api.deletePantryItem(id);
      await refreshAll();
    },
    [refreshAll],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: '#0f172a' }}>🟢 Your Pantry</Text>
          <Text style={{ fontSize: 14, color: '#94a3b8' }}>{items.length} items</Text>
        </View>

        {/* Category tabs */}
        {visibleTabs.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 6, paddingBottom: 8 }}
          >
            {visibleTabs.map((t) => {
              const active = activeTab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setActiveTab(t.key)}
                  style={{
                    backgroundColor: active ? brand : '#fff',
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    flexShrink: 0,
                    borderWidth: 1.5,
                    borderColor: active ? brand : '#e2e8f0',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : '#475569' }}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 10 }}>
          {items.length === 0 && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 32 }}>🛒</Text>
              <Text style={{ fontSize: 15, color: '#94a3b8', marginTop: 8, textAlign: 'center' }}>
                Nothing yet — add groceries on the Cook tab.
              </Text>
            </View>
          )}

          {filteredItems.length === 0 && items.length > 0 && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#94a3b8' }}>No {activeTab} items in pantry.</Text>
            </View>
          )}

          {/* Bands in priority order: expired → soon → frozen → fresh */}
          {bands.expired.length > 0 && <BandSection band="expired" items={bands.expired} onDelete={onDelete} />}
          {bands.soon.length > 0    && <BandSection band="soon"    items={bands.soon}    onDelete={onDelete} />}
          {bands.frozen.length > 0  && <BandSection band="frozen"  items={bands.frozen}  onDelete={onDelete} />}
          {bands.fresh.length > 0   && <BandSection band="fresh"   items={bands.fresh}   onDelete={onDelete} />}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ── BandSection ───────────────────────────────────────────────────────────────

function BandSection({ band, items, onDelete }: { band: Band; items: PantryItem[]; onDelete: (id: string) => void }) {
  const cfg = bandConfig[band];
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: cfg.labelColor }}>{cfg.label}</Text>
      </View>
      {items.map((it, i) => (
        <View
          key={it.id}
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 14, paddingVertical: 11,
            borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#f1f5f9',
            borderLeftWidth: 4, borderLeftColor: cfg.border,
            backgroundColor: cfg.bg,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#0f172a' }}>{it.name}</Text>
            <Text style={{ fontSize: 13, color: '#64748b' }}>
              {it.quantity}{it.unit !== 'unit' ? ` ${it.unit}` : ''}
              {band === 'frozen' ? (
                <Text style={{ color: '#38bdf8' }}>  · No expiry</Text>
              ) : it.expires_at ? (
                `  ·  ${daysLabel(it.expires_at)}`
              ) : null}
            </Text>
          </View>
          <Pressable onPress={() => onDelete(it.id)} hitSlop={12} style={{ paddingLeft: 8 }}>
            <Text style={{ fontSize: 18, color: '#cbd5e1' }}>✕</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
