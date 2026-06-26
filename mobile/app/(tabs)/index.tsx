import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { parseText } from '@pantrytoplate/shared';
import type { RecipeSuggestion } from '@pantrytoplate/shared';
import { useSharedAppData as useAppData } from '../../lib/AppDataContext';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { useGroqSpeech } from '../../lib/useGroqSpeech';
import { formatGroceryTranscript } from '../../lib/groceryTranscript';
import { CookScreenSkeleton } from '../../components/LoadingScreen';

// ── constants ─────────────────────────────────────────────────────────────────

const brand = '#16a34a';

const TIME_OPTIONS = [
  { value: 15,   minTime: 0,   maxTime: 15,  label: '≤ 15 min' },
  { value: 30,   minTime: 15,  maxTime: 30,  label: '15 – 30 min' },
  { value: 60,   minTime: 30,  maxTime: 60,  label: '30 – 60 min' },
  { value: 120,  minTime: 60,  maxTime: 120, label: '1 – 2 hrs' },
  { value: 9999, minTime: 120, maxTime: 0,   label: '2 hrs +' },
];

const CUISINE_OPTIONS = [
  { value: '',        label: 'All cuisines' },
  { value: 'indian',  label: '🇮🇳 Indian' },
  { value: 'italian', label: '🇮🇹 Italian' },
  { value: 'chinese', label: '🇨🇳 Chinese' },
  { value: 'mexican', label: '🇲🇽 Mexican' },
  { value: 'thai',    label: '🇹🇭 Thai' },
];

const CATEGORY_OPTIONS = [
  { value: '',          label: 'Any course' },
  { value: 'breakfast', label: '🌅 Breakfast' },
  { value: 'lunch',     label: '🥗 Lunch' },
  { value: 'dinner',    label: '🍽️ Dinner' },
  { value: 'side',      label: '🥙 Side dish' },
  { value: 'dessert',   label: '🍮 Dessert' },
  { value: 'snack',     label: '🥨 Snack' },
  { value: 'drink',     label: '🥤 Drink' },
];

const DIETARY_OPTIONS = [
  { value: '',             label: 'All' },
  { value: 'vegetarian',   label: '🥗 Veg' },
  { value: 'vegan',        label: '🌱 Vegan' },
  { value: 'high-protein', label: '💪 High Protein' },
  { value: 'low-carb',     label: '🥬 Low Carb' },
];

// ── CookScreen ────────────────────────────────────────────────────────────────

export default function CookScreen() {
  const {
    items,
    recipes,
    recipesLoading,
    nutrition,
    game,
    loading,
    refreshAll,
    refreshStats,
    selectFilters,
    selectedTime,
    selectedArea,
    selectedCategory,
  } = useAppData();
  const { user } = useAuth();
  const router = useRouter();

  // ── grocery input ────────────────────────────────────────────────────────
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const preview = useMemo(() => (text.trim() ? parseText(text) : []), [text]);

  // Voice input via Groq Whisper
  const { recording, transcribing, transcript, error: speechError, start: startRec, stop: stopRec, reset: resetSpeech } = useGroqSpeech();

  // When transcription completes, format and append to text input
  useEffect(() => {
    if (transcript) {
      const formatted = formatGroceryTranscript(transcript);
      setText((prev) => (prev ? `${prev}, ${formatted}` : formatted));
      resetSpeech();
    }
  }, [transcript, resetSpeech]);

  const onMicPress = useCallback(() => {
    if (recording) {
      stopRec();
    } else {
      startRec();
    }
  }, [recording, startRec, stopRec]);

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

  // ── recipe search ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RecipeSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchOffset, setSearchOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchQuery.trim();
    if (!q) {
      setSearchMode(false);
      setSearchResults([]);
      setSearchOffset(0);
      setCanLoadMore(false);
      return;
    }
    setSearchMode(true);
    setSearching(true);
    setSearchOffset(0);
    setCanLoadMore(false);
    debounceRef.current = setTimeout(async () => {
      try {
        const { recipes } = await api.searchRecipes({ q, limit: 20, dietary: selectedDietary || undefined });
        setSearchResults(recipes);
        setCanLoadMore(recipes.length === 20);
      } catch {
        setSearchResults([]);
        setCanLoadMore(false);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, selectedDietary]);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchMode(false);
    setSearchResults([]);
  };

  // ── filter drawer ────────────────────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftTime, setDraftTime] = useState(selectedTime);
  const [draftArea, setDraftArea] = useState(selectedArea);
  const [draftCategory, setDraftCategory] = useState(selectedCategory);
  const [selectedDietary, setSelectedDietary] = useState('');
  const [draftDietary, setDraftDietary] = useState('');

  const openFilter = () => {
    setDraftTime(selectedTime);
    setDraftArea(selectedArea);
    setDraftCategory(selectedCategory);
    setDraftDietary(selectedDietary);
    setFilterOpen(true);
  };

  const applyFilter = () => {
    const opt = TIME_OPTIONS.find((t) => t.value === draftTime) ?? TIME_OPTIONS[1];
    selectFilters(opt.value, opt.minTime, opt.maxTime, draftArea, draftCategory);
    setSelectedDietary(draftDietary);
    setFilterOpen(false);
  };

  const resetFilter = () => {
    setDraftTime(15);
    setDraftArea('');
    setDraftCategory('');
    setDraftDietary('');
  };

  const activeFilterCount =
    (selectedArea ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (selectedTime !== 15 ? 1 : 0) +
    (selectedDietary ? 1 : 0);

  // ── share story ──────────────────────────────────────────────────────────
  const [sharing, setSharing] = useState(false);
  const onShare = useCallback(async () => {
    setSharing(true);
    try {
      const story = await api.story();
      await Share.share({ message: story.share_text });
      await api.sendEvent('share');
      await refreshStats();
    } catch {
      /* user cancelled */
    } finally {
      setSharing(false);
    }
  }, [refreshStats]);

  // ── derived values ───────────────────────────────────────────────────────
  const consumed = nutrition?.totals.calories ?? 0;
  const goal = nutrition?.goal.daily_calories ?? 2000;
  const calPct = Math.min(1, consumed / goal);

  const displayRecipes = searchMode ? searchResults : recipes;
  const displayLoading = searchMode ? searching : recipesLoading;

  const timeLabel = TIME_OPTIONS.find((t) => t.value === selectedTime)?.label ?? '';
  const areaLabel = CUISINE_OPTIONS.find((o) => o.value === selectedArea)?.label ?? '';
  const catLabel  = CATEGORY_OPTIONS.find((o) => o.value === selectedCategory)?.label ?? '';
  const filterSummary = [areaLabel, catLabel, timeLabel].filter(Boolean).join(' · ');

  if (loading) return <CookScreenSkeleton />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView contentContainerStyle={{ gap: 12 }}>

        {/* ── Stats header banner ────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: brand,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 20,
          }}
        >
          {/* Top row: title + share + avatar */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pressable onPress={() => router.push('/profile')}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>PantryPilot</Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Cook Smarter, Waste Less.</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={onShare}
                disabled={sharing}
                style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  {sharing ? '…' : 'Share 📤'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/profile')}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}
              >
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={{ width: 36, height: 36 }} referrerPolicy="no-referrer" />
                ) : (
                  <Text style={{ fontSize: 18 }}>👤</Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* Calorie ring + streak block */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 }}>
            <CalorieRing pct={calPct} consumed={consumed} goal={goal} />
            <Pressable style={{ flex: 1 }} onPress={() => router.push('/(tabs)/you')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>
                  🔥 {game?.streak.current_streak ?? 0}-day streak
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                {game?.total_points ?? 0} points
              </Text>
              {game?.next_reward && (
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                  Next: {game.next_reward.title} at {game.next_reward.points_needed} pts
                </Text>
              )}
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                Tap to see details →
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Add groceries ──────────────────────────────────────────────── */}
        <View style={cardStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder='Add groceries — e.g. "2 lbs chicken, dozen eggs"'
              placeholderTextColor="#94a3b8"
              style={[inputStyle, { flex: 1 }]}
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <Pressable
              onPress={onMicPress}
              disabled={transcribing}
              style={{
                width: 46, height: 46, borderRadius: 12,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: recording ? '#ef4444' : transcribing ? '#fef3c7' : '#dcfce7',
                opacity: transcribing ? 0.7 : 1,
              }}
            >
              <Text style={{ fontSize: 20 }}>
                {recording ? '⏹' : transcribing ? '⏳' : '🎤'}
              </Text>
            </Pressable>
          </View>

          {transcribing && (
            <View style={{ backgroundColor: '#fffbeb', borderRadius: 10, padding: 10, marginTop: 8 }}>
              <Text style={{ fontSize: 13, color: '#92400e' }}>Transcribing with Groq Whisper…</Text>
            </View>
          )}

          {speechError && (
            <View style={{ backgroundColor: '#fef2f2', borderRadius: 10, padding: 10, marginTop: 8 }}>
              <Text style={{ fontSize: 13, color: '#ef4444' }}>{speechError}</Text>
            </View>
          )}

          {preview.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {preview.map((item, i) => (
                <View key={i} style={chipStyle}>
                  <Text style={{ fontSize: 13, color: '#475569' }}>
                    {item.name}
                    {(item.quantity !== 1 || item.unit !== 'unit') ? (
                      <Text style={{ color: '#94a3b8' }}>
                        {`  ·  ${item.quantity}${item.unit !== 'unit' ? ' ' + item.unit : ''}`}
                      </Text>
                    ) : null}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {preview.length > 0 && (
            <Pressable
              onPress={save}
              disabled={saving}
              style={[btnStyle, { backgroundColor: saving ? '#86efac' : brand, marginTop: 12 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
                {saving ? 'Adding…' : `Add ${preview.length} item${preview.length > 1 ? 's' : ''} to pantry`}
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Recipe section ─────────────────────────────────────────────── */}
        <View style={cardStyle}>
          {/* Header row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>
                {searchMode ? '🔍 Search results' : '🍽️ Suggested for you'}
              </Text>
              {!searchMode && filterSummary ? (
                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{filterSummary}</Text>
              ) : null}
              {searchMode && !searching && searchResults.length > 0 ? (
                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {searchResults.length} recipe{searchResults.length !== 1 ? 's' : ''} found
                </Text>
              ) : null}
            </View>
            {!searchMode && (
              <Pressable
                onPress={openFilter}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  borderWidth: 1, borderColor: activeFilterCount > 0 ? brand : '#e2e8f0',
                  borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
                }}
              >
                <Text style={{ fontSize: 13, color: activeFilterCount > 0 ? brand : '#64748b', fontWeight: '600' }}>
                  ⚙ Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Search bar */}
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
              backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 9,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 14, color: '#94a3b8' }}>🔍</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search recipes… e.g. biryani, pasta"
              placeholderTextColor="#94a3b8"
              style={{ flex: 1, fontSize: 14, color: '#0f172a' }}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={clearSearch} hitSlop={8}>
                <Text style={{ fontSize: 16, color: '#94a3b8' }}>✕</Text>
              </Pressable>
            )}
          </View>

          {displayLoading && (
            <ActivityIndicator color={brand} style={{ paddingVertical: 24 }} />
          )}

          {!displayLoading && displayRecipes.length === 0 && (
            <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, paddingVertical: 20 }}>
              {searchMode
                ? searchQuery.trim() ? `No recipes found for "${searchQuery}"` : 'Start typing to search…'
                : 'Add a few groceries and we\'ll suggest meals you can make.'}
            </Text>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {displayRecipes.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                onCooked={refreshStats}
                onTap={() => router.push(`/recipe/${r.id}`)}
              />
            ))}
          </ScrollView>

          {searchMode && canLoadMore && !searching && !loadingMore && (
            <Pressable
              onPress={async () => {
                setLoadingMore(true);
                try {
                  const q = searchQuery.trim();
                  const { recipes: more } = await api.searchRecipes({
                    q,
                    limit: 20,
                    offset: searchOffset + 20,
                    dietary: selectedDietary || undefined,
                  });
                  setSearchResults((prev) => [...prev, ...more]);
                  setCanLoadMore(more.length === 20);
                  setSearchOffset((prev) => prev + 20);
                } catch {
                  /* ignore */
                } finally {
                  setLoadingMore(false);
                }
              }}
              style={[
                btnStyle,
                {
                  backgroundColor: '#f0fdf4',
                  borderWidth: 1,
                  borderColor: brand,
                  marginTop: 12,
                },
              ]}
            >
              <Text style={{ color: brand, fontWeight: '600', fontSize: 15 }}>Load more</Text>
            </Pressable>
          )}

          {searchMode && loadingMore && (
            <ActivityIndicator color={brand} style={{ paddingVertical: 12 }} />
          )}
        </View>

        {/* Pantry count badge */}
        {items.length > 0 && (
          <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, paddingBottom: 8 }}>
            🥦 {items.length} items in your pantry · open Pantry tab to manage
          </Text>
        )}
      </ScrollView>

      {/* ── Filter drawer modal ─────────────────────────────────────────── */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
          onPress={() => setFilterOpen(false)}
        />
        <View style={{
          backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 16,
          position: 'absolute', bottom: 0, left: 0, right: 0,
        }}>
          {/* Handle */}
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' }} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#0f172a' }}>Filter recipes</Text>
            <Pressable onPress={resetFilter}>
              <Text style={{ fontSize: 13, color: brand, fontWeight: '600' }}>Reset all</Text>
            </Pressable>
          </View>

          {/* Dietary */}
          <View>
            <Text style={drawerLabelStyle}>Dietary</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {DIETARY_OPTIONS.map((o) => (
                  <Pressable
                    key={o.value}
                    onPress={() => setDraftDietary(o.value)}
                    style={[filterChipStyle, draftDietary === o.value && { backgroundColor: brand, borderColor: brand }]}
                  >
                    <Text style={[filterChipText, draftDietary === o.value && { color: '#fff' }]}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Cuisine */}
          <View>
            <Text style={drawerLabelStyle}>Cuisine</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CUISINE_OPTIONS.map((o) => (
                  <Pressable
                    key={o.value}
                    onPress={() => setDraftArea(o.value)}
                    style={[filterChipStyle, draftArea === o.value && { backgroundColor: brand, borderColor: brand }]}
                  >
                    <Text style={[filterChipText, draftArea === o.value && { color: '#fff' }]}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Course */}
          <View>
            <Text style={drawerLabelStyle}>Course</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CATEGORY_OPTIONS.map((o) => (
                  <Pressable
                    key={o.value}
                    onPress={() => setDraftCategory(o.value)}
                    style={[filterChipStyle, draftCategory === o.value && { backgroundColor: '#f97316', borderColor: '#f97316' }]}
                  >
                    <Text style={[filterChipText, draftCategory === o.value && { color: '#fff' }]}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Cook time */}
          <View>
            <Text style={drawerLabelStyle}>Cook time</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TIME_OPTIONS.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => setDraftTime(o.value)}
                  style={[filterChipStyle, draftTime === o.value && { backgroundColor: '#1e293b', borderColor: '#1e293b' }]}
                >
                  <Text style={[filterChipText, draftTime === o.value && { color: '#fff' }]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Apply */}
          <Pressable onPress={applyFilter} style={[btnStyle, { backgroundColor: brand }]}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Apply filters</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── CalorieRing ───────────────────────────────────────────────────────────────

function CalorieRing({ pct, consumed, goal }: { pct: number; consumed: number; goal: number }) {
  const size = 88;
  const thickness = 8;
  const deg = Math.round(pct * 360);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: thickness, borderColor: 'rgba(255,255,255,0.25)' }} />
      {deg > 0 && (
        <View style={{
          position: 'absolute', width: size, height: size, borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: deg >= 180 ? '#fff' : 'transparent',
          borderRightColor: '#fff',
          transform: [{ rotate: '-90deg' }],
        }} />
      )}
      {deg > 180 && (
        <View style={{
          position: 'absolute', width: size, height: size, borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: 'transparent',
          borderRightColor: '#fff',
          borderBottomColor: '#fff',
          transform: [{ rotate: `${deg - 270}deg` }],
        }} />
      )}
      <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>{consumed}</Text>
      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)' }}>/ {goal} cal</Text>
    </View>
  );
}

// ── RecipeCard ────────────────────────────────────────────────────────────────

function RecipeCard({
  recipe,
  onCooked,
  onTap,
}: {
  recipe: RecipeSuggestion;
  onCooked: () => void;
  onTap: () => void;
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
    <Pressable
      onPress={onTap}
      style={{
        width: 200, marginRight: 12, borderRadius: 14,
        overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fff',
      }}
    >
      {recipe.image ? (
        <Image source={{ uri: recipe.image }} style={{ width: 200, height: 120 }} resizeMode="cover" />
      ) : (
        <View style={{ width: 200, height: 120, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 40 }}>🍽️</Text>
        </View>
      )}
      <View style={{ padding: 10 }}>
        {recipe.category ? (
          <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff7ed', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 4 }}>
            <Text style={{ fontSize: 10, color: '#ea580c', fontWeight: '600' }}>{recipe.category}</Text>
          </View>
        ) : null}
        <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: '600', color: '#0f172a', minHeight: 36 }}>
          {recipe.title}
        </Text>
        <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          ⏱ {recipe.time_minutes}m · {recipe.calories} cal
          {recipe.match_score > 0 ? (
            <Text style={{ color: '#15803d', fontWeight: '600' }}>
              {' · '}{Math.round(recipe.match_score * 100)}% match
            </Text>
          ) : null}
        </Text>
        {(recipe.missing_ingredients?.length ?? 0) > 0 && (
          <Text numberOfLines={1} style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            Need: {recipe.missing_ingredients.slice(0, 3).join(', ')}
          </Text>
        )}
        <Pressable
          onPress={cook}
          disabled={cooking || done}
          style={{ backgroundColor: done ? '#86efac' : cooking ? '#dcfce7' : brand, borderRadius: 10, paddingVertical: 8, alignItems: 'center', marginTop: 8 }}
        >
          <Text style={{ color: done ? '#166534' : '#fff', fontWeight: '600', fontSize: 13 }}>
            {done ? '✓ Cooked!' : cooking ? 'Logging…' : 'View recipe →'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ── shared styles ─────────────────────────────────────────────────────────────

const cardStyle = {
  backgroundColor: '#fff',
  marginHorizontal: 12,
  borderRadius: 16,
  padding: 14,
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
} as const;

const inputStyle = {
  borderWidth: 1,
  borderColor: '#e2e8f0',
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
  color: '#0f172a',
} as const;

const chipStyle = {
  backgroundColor: '#f1f5f9',
  borderRadius: 999,
  paddingHorizontal: 12,
  paddingVertical: 5,
} as const;

const btnStyle = {
  borderRadius: 12,
  paddingVertical: 13,
  alignItems: 'center' as const,
};

const drawerLabelStyle = {
  fontSize: 11,
  fontWeight: '700' as const,
  color: '#94a3b8',
  textTransform: 'uppercase' as const,
  letterSpacing: 0.8,
  marginBottom: 8,
};

const filterChipStyle = {
  borderWidth: 1,
  borderColor: '#e2e8f0',
  borderRadius: 999,
  paddingHorizontal: 14,
  paddingVertical: 7,
  backgroundColor: '#fff',
} as const;

const filterChipText = {
  fontSize: 13,
  fontWeight: '500' as const,
  color: '#475569',
};
