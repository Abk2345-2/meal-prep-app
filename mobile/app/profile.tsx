import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { useLang, LANGUAGES } from '../lib/LanguageContext';
import { api } from '../lib/api';

const brand = '#16a34a';

type MealEntry = {
  id: string;
  source: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  cooked_at: string;
};
type DayLog = { date: string; calories: number; meals: MealEntry[] };

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { lang, setLang } = useLang();

  const [history, setHistory] = useState<DayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // Nutrition goals
  const [goalCal, setGoalCal] = useState('2000');
  const [goalProtein, setGoalProtein] = useState('100');
  const [goalCarbs, setGoalCarbs] = useState('250');
  const [goalFat, setGoalFat] = useState('65');
  const [savingGoal, setSavingGoal] = useState(false);
  const savingRef = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.nutritionHistory(30),
      api.getGoal(),
    ]).then(([hist, goal]) => {
      setHistory(hist.history);
      setGoalCal(String(goal.daily_calories));
      setGoalProtein(String(goal.protein_g));
      setGoalCarbs(String(goal.carbs_g));
      setGoalFat(String(goal.fat_g));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveGoal = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSavingGoal(true);
    try {
      await api.setGoal({
        daily_calories: parseInt(goalCal, 10) || 2000,
        protein_g: parseInt(goalProtein, 10) || 100,
        carbs_g: parseInt(goalCarbs, 10) || 250,
        fat_g: parseInt(goalFat, 10) || 65,
      });
      Alert.alert('Saved', 'Your daily nutrition goals have been updated.');
    } catch {
      Alert.alert('Error', 'Could not save goals. Please try again.');
    } finally {
      savingRef.current = false;
      setSavingGoal(false);
    }
  }, [goalCal, goalProtein, goalCarbs, goalFat]);

  const removeMeal = useCallback(
    async (mealId: string) => {
      setRemoving(mealId);
      try {
        await api.deleteMealLog(mealId);
        const d = await api.nutritionHistory(30);
        setHistory(d.history);
      } finally {
        setRemoving(null);
      }
    },
    [],
  );

  async function handleSignOut() {
    await logout();
    router.replace('/login');
  }

  const totalDays = history.length;
  const avgCalories = totalDays
    ? Math.round(history.reduce((s, d) => s + d.calories, 0) / totalDays)
    : 0;
  const totalMeals = history.reduce((s, d) => s + d.meals.length, 0);

  const initials = user?.name?.charAt(0).toUpperCase() ?? '?';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: '#1e293b',
            padding: 20,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16 }}>←</Text>
            </Pressable>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Profile</Text>
            <Pressable
              onPress={handleSignOut}
              style={{
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.15)',
                paddingHorizontal: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Sign out</Text>
            </Pressable>
          </View>

          {/* Avatar + name */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20 }}>
            {user?.avatar ? (
              <Image
                source={{ uri: user.avatar }}
                style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }}
              />
            ) : (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>{initials}</Text>
              </View>
            )}
            <View>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>{user?.name ?? 'You'}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{user?.email ?? ''}</Text>
            </View>
          </View>

          {/* Summary stats */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {[
              { value: totalDays,    label: 'Active days' },
              { value: totalMeals,   label: 'Meals logged' },
              { value: avgCalories,  label: 'Avg cal/day' },
            ].map(({ value, label }) => (
              <View
                key={label}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{value}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Language selector */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={{
            backgroundColor: '#fff', borderRadius: 16, padding: 16,
            shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
          }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 12 }}>
              🌐 Language / भाषा
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LANGUAGES.map((l) => (
                <Pressable
                  key={l.code}
                  onPress={() => setLang(l.code)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                    backgroundColor: lang === l.code ? brand : '#f1f5f9',
                    borderWidth: 1.5,
                    borderColor: lang === l.code ? brand : '#e2e8f0',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: lang === l.code ? '#fff' : '#475569' }}>
                    {l.nativeName}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Daily nutrition goals */}
        <View style={{ padding: 16, paddingBottom: 0 }}>
          <View style={{
            backgroundColor: '#fff', borderRadius: 16, padding: 16,
            shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
          }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 14 }}>
              🎯 Daily nutrition goals
            </Text>
            {[
              { label: 'Calories',   value: goalCal,     setter: setGoalCal,     unit: 'kcal', kb: 'numeric' },
              { label: 'Protein',    value: goalProtein, setter: setGoalProtein, unit: 'g',    kb: 'numeric' },
              { label: 'Carbs',      value: goalCarbs,   setter: setGoalCarbs,   unit: 'g',    kb: 'numeric' },
              { label: 'Fat',        value: goalFat,     setter: setGoalFat,     unit: 'g',    kb: 'numeric' },
            ].map(({ label, value, setter, unit }) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ width: 80, fontSize: 14, color: '#475569', fontWeight: '500' }}>{label}</Text>
                <TextInput
                  value={value}
                  onChangeText={setter}
                  keyboardType="numeric"
                  style={{
                    flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#0f172a',
                  }}
                />
                <Text style={{ width: 36, fontSize: 13, color: '#94a3b8', textAlign: 'right' }}>{unit}</Text>
              </View>
            ))}
            <Pressable
              onPress={saveGoal}
              disabled={savingGoal}
              style={{
                backgroundColor: savingGoal ? '#dcfce7' : brand,
                borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4,
              }}
            >
              <Text style={{ color: savingGoal ? '#166534' : '#fff', fontWeight: '600', fontSize: 15 }}>
                {savingGoal ? 'Saving…' : 'Save goals'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* History */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 12 }}>
            📋 Calorie log — last 30 days
          </Text>

          {loading && (
            <Text style={{ textAlign: 'center', color: '#94a3b8', paddingVertical: 24 }}>Loading…</Text>
          )}

          {!loading && history.length === 0 && (
            <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, paddingVertical: 24 }}>
              No meals logged yet. Cook something!
            </Text>
          )}

          {history.map((day) => {
            const isOpen = expandedDay === day.date;
            return (
              <View
                key={day.date}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  overflow: 'hidden',
                  marginBottom: 10,
                  shadowColor: '#000',
                  shadowOpacity: 0.05,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <Pressable
                  onPress={() => setExpandedDay(isOpen ? null : day.date)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 14,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a' }}>
                      {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                      {day.meals.length} meal{day.meals.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569' }}>{day.calories} cal</Text>
                    </View>
                    <Text style={{ color: '#94a3b8' }}>{isOpen ? '▲' : '▼'}</Text>
                  </View>
                </Pressable>

                {isOpen && (
                  <View style={{ borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                    {day.meals.map((m, i) => (
                      <View
                        key={m.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          backgroundColor: i % 2 === 0 ? '#f8fafc' : '#fff',
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '500', color: '#0f172a' }} numberOfLines={1}>
                            {m.source}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                            {m.calories} cal · P {m.protein_g}g · C {m.carbs_g}g · F {m.fat_g}g
                            {'  ·  '}
                            {new Date(m.cooked_at).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => removeMeal(m.id)}
                          disabled={removing === m.id}
                          style={{
                            marginLeft: 10,
                            borderWidth: 1,
                            borderColor: '#fca5a5',
                            borderRadius: 8,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            opacity: removing === m.id ? 0.4 : 1,
                          }}
                        >
                          <Text style={{ fontSize: 12, color: '#ef4444' }}>
                            {removing === m.id ? '…' : 'Remove'}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
