import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseText } from '@pantrytoplate/shared';
import type { RecipeSuggestion } from '@pantrytoplate/shared';
import { useAppData } from '../../lib/useAppData';
import { api } from '../../lib/api';

const TIME_OPTIONS = [15, 30, 60];

const brand = '#16a34a';

export default function CookScreen() {
  const { items, recipes, recipesLoading, maxTime, selectTime, refreshAll, refreshStats } =
    useAppData();

  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => (text.trim() ? parseText(text) : []), [text]);

  const save = useCallback(async () => {
    if (preview.length === 0) return;
    setSaving(true);
    try {
      await api.addGroceries({ text });
      await api.sendEvent('log_pantry');
      setText('');
      await refreshAll();
    } finally {
      setSaving(false);
    }
  }, [preview.length, text, refreshAll]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Header */}
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#0f172a' }}>
          PantryToPlate 🍽️
        </Text>

        {/* Add Groceries */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 16,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder='e.g. "2 lbs chicken, dozen eggs, 500g rice"'
            placeholderTextColor="#94a3b8"
            style={{
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: '#0f172a',
            }}
            returnKeyType="done"
            onSubmitEditing={save}
          />

          {preview.length > 0 && (
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}
            >
              {preview.map((item, i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: '#f1f5f9',
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                  }}
                >
                  <Text style={{ fontSize: 13, color: '#475569' }}>
                    {item.quantity} {item.unit !== 'unit' ? item.unit + ' ' : ''}
                    {item.name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {preview.length > 0 && (
            <Pressable
              onPress={save}
              disabled={saving}
              style={{
                backgroundColor: saving ? '#86efac' : brand,
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: 'center',
                marginTop: 12,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
                {saving
                  ? 'Adding…'
                  : `Add ${preview.length} item${preview.length > 1 ? 's' : ''} to pantry`}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Time filter */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 16,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#0f172a' }}>
              Suggested for you
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {TIME_OPTIONS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => selectTime(t)}
                  style={{
                    backgroundColor: maxTime === t ? brand : '#f1f5f9',
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: maxTime === t ? '#fff' : '#64748b',
                    }}
                  >
                    {t}m
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {recipesLoading && (
            <ActivityIndicator color={brand} style={{ paddingVertical: 24 }} />
          )}

          {!recipesLoading && recipes.length === 0 && (
            <Text
              style={{
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: 14,
                paddingVertical: 24,
              }}
            >
              Add a few groceries and we'll suggest meals you can make.
            </Text>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 12 }}>
            {recipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} onCooked={refreshStats} />
            ))}
          </ScrollView>
        </View>

        {/* Pantry count badge */}
        {items.length > 0 && (
          <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            🥦 {items.length} items in your pantry · open Pantry tab to manage
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RecipeCard({
  recipe,
  onCooked,
}: {
  recipe: RecipeSuggestion;
  onCooked: () => void;
}) {
  const [cooking, setCooking] = useState(false);
  const [done, setDone] = useState(false);

  const cook = useCallback(async () => {
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
  }, [recipe, onCooked]);

  return (
    <View
      style={{
        width: 200,
        marginRight: 12,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        backgroundColor: '#fff',
      }}
    >
      {recipe.image ? (
        <Image
          source={{ uri: recipe.image }}
          style={{ width: 200, height: 120 }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: 200,
            height: 120,
            backgroundColor: '#dcfce7',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 40 }}>🍽️</Text>
        </View>
      )}
      <View style={{ padding: 12 }}>
        <Text
          numberOfLines={2}
          style={{ fontSize: 13, fontWeight: '600', color: '#0f172a', minHeight: 36 }}
        >
          {recipe.title}
        </Text>
        <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          ⏱ {recipe.time_minutes}m · {recipe.calories} cal ·{' '}
          <Text style={{ color: '#15803d', fontWeight: '600' }}>
            {Math.round(recipe.match_score * 100)}% match
          </Text>
        </Text>
        {recipe.missing_ingredients.length > 0 && (
          <Text
            numberOfLines={1}
            style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}
          >
            Need: {recipe.missing_ingredients.slice(0, 2).join(', ')}
          </Text>
        )}
        <Pressable
          onPress={cook}
          disabled={cooking || done}
          style={{
            backgroundColor: done ? '#86efac' : cooking ? '#dcfce7' : brand,
            borderRadius: 10,
            paddingVertical: 9,
            alignItems: 'center',
            marginTop: 10,
          }}
        >
          <Text style={{ color: done ? '#166534' : '#fff', fontWeight: '600', fontSize: 13 }}>
            {done ? '✓ Cooked!' : cooking ? 'Logging…' : 'Cook now'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
