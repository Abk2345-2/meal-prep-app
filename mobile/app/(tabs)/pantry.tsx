import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PantryItem } from '@pantrytoplate/shared';
import { useAppData } from '../../lib/useAppData';
import { api } from '../../lib/api';

type Band = 'fresh' | 'soon' | 'expired';

function expiryBand(item: PantryItem): Band {
  if (!item.expires_at) return 'fresh';
  const days = (new Date(item.expires_at).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 'expired';
  if (days <= 2) return 'soon';
  return 'fresh';
}

function daysLabel(expiresAt: string): string {
  const days = Math.round((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

const bandConfig: Record<Band, { dot: string; bg: string; border: string; label: string }> = {
  fresh:   { dot: '🟢', bg: '#f0fdf4', border: '#86efac', label: 'In stock' },
  soon:    { dot: '🟡', bg: '#fffbeb', border: '#fcd34d', label: 'Expiring soon' },
  expired: { dot: '🔴', bg: '#fef2f2', border: '#fca5a5', label: 'Expired' },
};

export default function PantryScreen() {
  const { items, refreshAll } = useAppData();

  const groups = useMemo(() => {
    const g: Record<Band, PantryItem[]> = { fresh: [], soon: [], expired: [] };
    for (const it of items) g[expiryBand(it)].push(it);
    return g;
  }, [items]);

  const onDelete = useCallback(
    async (id: string) => {
      await api.deletePantryItem(id);
      await refreshAll();
    },
    [refreshAll],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text style={{ fontSize: 26, fontWeight: '700', color: '#0f172a' }}>
            🥦 Pantry
          </Text>
          <Text style={{ fontSize: 14, color: '#94a3b8' }}>{items.length} items</Text>
        </View>

        {items.length === 0 && (
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 32,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 32 }}>🛒</Text>
            <Text style={{ fontSize: 15, color: '#94a3b8', marginTop: 8, textAlign: 'center' }}>
              Nothing yet — add groceries on the Cook tab.
            </Text>
          </View>
        )}

        {(['soon', 'expired', 'fresh'] as Band[]).map((band) =>
          groups[band].length > 0 ? (
            <BandSection
              key={band}
              band={band}
              items={groups[band]}
              onDelete={onDelete}
            />
          ) : null,
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BandSection({
  band,
  items,
  onDelete,
}: {
  band: Band;
  items: PantryItem[];
  onDelete: (id: string) => void;
}) {
  const cfg = bandConfig[band];
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748b' }}>
          {cfg.dot} {cfg.label}
        </Text>
      </View>
      {items.map((it, i) => (
        <View
          key={it.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: '#f1f5f9',
            borderLeftWidth: 4,
            borderLeftColor: cfg.border,
            backgroundColor: cfg.bg,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#0f172a' }}>{it.name}</Text>
            <Text style={{ fontSize: 13, color: '#64748b' }}>
              {it.quantity} {it.unit !== 'unit' ? it.unit : ''}
              {it.expires_at ? `  ·  ${daysLabel(it.expires_at)}` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => onDelete(it.id)}
            hitSlop={12}
            style={{ paddingLeft: 8 }}
          >
            <Text style={{ fontSize: 18, color: '#cbd5e1' }}>✕</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
