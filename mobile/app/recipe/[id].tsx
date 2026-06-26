import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { RecipeSuggestion } from '@pantrytoplate/shared';
import { api } from '../../lib/api';
import { useLang, LANGUAGES } from '../../lib/LanguageContext';

const brand = '#16a34a';

function parseSteps(instructions: string): string[] {
  if (!instructions) return [];
  // Split on numbered steps like "1." or "\r\n" paragraph breaks
  const lines = instructions
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // If lines are already numbered ("1. Step"), return them stripped of numbers
  const numbered = lines.every((l) => /^\d+\./.test(l));
  if (numbered) return lines.map((l) => l.replace(/^\d+\.\s*/, ''));
  return lines;
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cooking, setCooking] = useState(false);
  const [cooked, setCooked] = useState(false);
  const { lang } = useLang();
  const [translatedSteps, setTranslatedSteps] = useState<string[] | null>(null);
  const [translating, setTranslating] = useState(false);
  const currentLang = LANGUAGES.find(l => l.code === lang);

  useEffect(() => {
    api
      .getRecipe(id)
      .then(setRecipe)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const logCooked = useCallback(async () => {
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
  }, [recipe, cooked]);

  const translateRecipe = useCallback(async () => {
    if (lang === 'en' || !recipe?.id) return;
    setTranslating(true);
    try {
      const res = await api.translateRecipe(recipe.id, lang);
      setTranslatedSteps(parseSteps(res.instructions));
    } catch {
      // silently fail — keep original text
    } finally {
      setTranslating(false);
    }
  }, [lang, recipe?.id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={brand} />
      </SafeAreaView>
    );
  }

  if (error || !recipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc', padding: 16 }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <Text style={{ color: brand, fontSize: 15 }}>← Back</Text>
        </Pressable>
        <View style={{ backgroundColor: '#fef2f2', borderRadius: 12, padding: 16 }}>
          <Text style={{ color: '#ef4444' }}>{error ?? 'Recipe not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Hero image */}
        <View style={{ position: 'relative' }}>
          {recipe.image ? (
            <Image
              source={{ uri: recipe.image }}
              style={{ width: '100%', height: 220 }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: '100%', height: 220, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 64 }}>🍽️</Text>
            </View>
          )}
          <Pressable
            onPress={() => router.back()}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(0,0,0,0.4)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>←</Text>
          </Pressable>
        </View>

        <View style={{ padding: 16, gap: 16 }}>
          {/* Title + meta */}
          <View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#0f172a' }}>{recipe.title}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
              <Text style={{ fontSize: 13, color: '#64748b' }}>⏱️ {recipe.time_minutes} min</Text>
              <Text style={{ fontSize: 13, color: '#64748b' }}>🔥 {recipe.calories} cal</Text>
              {recipe.area ? <Text style={{ fontSize: 13, color: '#64748b' }}>🌍 {recipe.area}</Text> : null}
              {recipe.category ? <Text style={{ fontSize: 13, color: '#64748b' }}>🍴 {recipe.category}</Text> : null}
              {hasMatchScore ? (
                <Text style={{ fontSize: 13, fontWeight: '600', color: brand }}>
                  {Math.round(recipe.match_score * 100)}% match
                </Text>
              ) : null}
            </View>
          </View>

          {/* Nutrition pills */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: 'Protein', value: recipe.protein_g },
              { label: 'Carbs', value: recipe.carbs_g },
              { label: 'Fat', value: recipe.fat_g },
            ].map(({ label, value }) => (
              <View
                key={label}
                style={{ flex: 1, backgroundColor: '#f1f5f9', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a' }}>{value}g</Text>
                <Text style={{ fontSize: 12, color: '#64748b' }}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Cook button */}
          <Pressable
            onPress={logCooked}
            disabled={cooking || cooked}
            style={{
              backgroundColor: cooked ? '#dcfce7' : cooking ? '#dcfce7' : brand,
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: cooked ? '#166534' : '#fff' }}>
              {cooked
                ? `✓ Logged — +${recipe.calories} cal added to today`
                : cooking
                ? 'Logging…'
                : `🍳 I cooked this  ·  +${recipe.calories} cal`}
            </Text>
          </Pressable>

          {/* Ingredients */}
          {recipe.ingredients?.length > 0 && (
            <View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 8 }}>
                🛒 Ingredients
              </Text>
              {recipe.ingredients.map((ing, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    backgroundColor: i % 2 === 0 ? '#f8fafc' : '#fff',
                    borderRadius: 8,
                    gap: 8,
                  }}
                >
                  <Text
                    style={{ fontSize: 14, fontWeight: '500', color: '#0f172a', flex: 1, flexWrap: 'wrap' }}
                    numberOfLines={2}
                  >
                    {ing.name}
                  </Text>
                  <Text
                    style={{ fontSize: 14, color: '#64748b', flexShrink: 0, textAlign: 'right', maxWidth: '45%', flexWrap: 'wrap' }}
                  >
                    {ing.measure}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Steps */}
          {steps.length > 0 && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#0f172a' }}>
                  👨‍🍳 Instructions
                </Text>
                {lang !== 'en' && (
                  <Pressable
                    onPress={translatedSteps ? () => setTranslatedSteps(null) : translateRecipe}
                    disabled={translating}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}
                  >
                    {translating ? (
                      <ActivityIndicator size="small" color={brand} />
                    ) : (
                      <Text style={{ fontSize: 12, color: brand, fontWeight: '600' }}>
                        🌐 {translatedSteps ? 'Show English' : `Translate to ${currentLang?.nativeName ?? lang}`}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
              {steps.map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: brand,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{i + 1}</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: '#475569', flex: 1, lineHeight: 21 }}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Source link */}
          {recipe.source_url ? (
            <Pressable
              onPress={() => Linking.openURL(recipe.source_url)}
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '500', color: brand }}>
                View original recipe ↗
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
