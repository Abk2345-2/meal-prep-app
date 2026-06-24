import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppData } from '../../lib/useAppData';
import { api } from '../../lib/api';

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

export default function TrackScreen() {
  const { nutrition, refreshStats } = useAppData();

  const [calories, setCalories] = useState('');
  const [source, setSource] = useState('');
  const [logging, setLogging] = useState(false);

  // History state
  const [history, setHistory] = useState<DayLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const consumed = nutrition?.totals.calories ?? 0;
  const goal = nutrition?.goal.daily_calories ?? 2000;
  const pct = Math.min(1, consumed / goal);

  const proteinConsumed = nutrition?.totals.protein_g ?? 0;
  const proteinGoal = nutrition?.goal.protein_g ?? 150;
  const carbsConsumed = nutrition?.totals.carbs_g ?? 0;
  const carbsGoal = nutrition?.goal.carbs_g ?? 250;
  const fatConsumed = nutrition?.totals.fat_g ?? 0;
  const fatGoal = nutrition?.goal.fat_g ?? 65;

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    api
      .nutritionHistory(30)
      .then((d) => setHistory(d.history))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function logMeal() {
    const cal = parseInt(calories, 10);
    if (!cal || cal <= 0) return;
    setLogging(true);
    try {
      await api.logMeal({ source: source.trim() || 'Quick log', calories: cal, protein_g: 0, carbs_g: 0, fat_g: 0 });
      await api.sendEvent('cook_meal');
      setCalories('');
      setSource('');
      await refreshStats();
      loadHistory();
    } finally {
      setLogging(false);
    }
  }

  const removeMeal = useCallback(
    async (mealId: string) => {
      setRemoving(mealId);
      try {
        await api.deleteMealLog(mealId);
        await refreshStats();
        loadHistory();
      } finally {
        setRemoving(null);
      }
    },
    [refreshStats, loadHistory],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#0f172a' }}>
          📊 Nutrition
        </Text>

        {/* Calorie ring card */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 20,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <CalorieRing pct={pct} consumed={consumed} goal={goal} />
          <Text style={{ fontSize: 14, color: '#64748b', marginTop: 12 }}>
            {Math.max(0, goal - consumed)} calories remaining today
          </Text>
        </View>

        {/* Macro bars */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 16,
            gap: 14,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#0f172a' }}>Macros</Text>
          <MacroBar label="Protein" consumed={proteinConsumed} goal={proteinGoal} color="#3b82f6" unit="g" />
          <MacroBar label="Carbs"   consumed={carbsConsumed}   goal={carbsGoal}   color="#f59e0b" unit="g" />
          <MacroBar label="Fat"     consumed={fatConsumed}     goal={fatGoal}     color="#ef4444" unit="g" />
        </View>

        {/* Quick log */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 16,
            gap: 10,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#0f172a' }}>
            Quick log a meal
          </Text>
          <TextInput
            value={source}
            onChangeText={setSource}
            placeholder="Meal name (e.g. Chicken salad)"
            placeholderTextColor="#94a3b8"
            style={{
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 15,
              color: '#0f172a',
            }}
          />
          <TextInput
            value={calories}
            onChangeText={setCalories}
            placeholder="Calories"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 15,
              color: '#0f172a',
            }}
            returnKeyType="done"
            onSubmitEditing={logMeal}
          />
          <Pressable
            onPress={logMeal}
            disabled={logging || !calories}
            style={{
              backgroundColor: logging || !calories ? '#dcfce7' : brand,
              borderRadius: 12,
              paddingVertical: 13,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: logging || !calories ? '#166534' : '#fff', fontWeight: '600', fontSize: 15 }}>
              {logging ? 'Logging…' : 'Log meal +15 pts'}
            </Text>
          </Pressable>
        </View>

        {/* Meals logged today */}
        {(nutrition?.meals?.length ?? 0) > 0 && (
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
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 10 }}>
              Today's meals
            </Text>
            {nutrition!.meals.map((m) => (
              <View
                key={m.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderTopColor: '#f1f5f9',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: '#334155' }}>{m.source}</Text>
                  <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                    {m.calories} cal · P {m.protein_g}g · C {m.carbs_g}g · F {m.fat_g}g
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

        {/* 30-day history */}
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 10 }}>
            📋 Last 30 days
          </Text>

          {historyLoading && (
            <Text style={{ textAlign: 'center', color: '#94a3b8', paddingVertical: 16 }}>Loading…</Text>
          )}

          {!historyLoading && history.length === 0 && (
            <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, paddingVertical: 16 }}>
              No meals logged yet. Start cooking!
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
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569' }}>
                        {day.calories} cal
                      </Text>
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

function CalorieRing({ pct, consumed, goal }: { pct: number; consumed: number; goal: number }) {
  const size = 160;
  const thickness = 14;
  const deg = Math.round(pct * 360);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: '#e2e8f0',
        }}
      />
      {deg > 0 && (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: thickness,
            borderColor: deg >= 180 ? brand : 'transparent',
            borderRightColor: brand,
            transform: [{ rotate: '-90deg' }],
          }}
        />
      )}
      {deg > 180 && (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: thickness,
            borderColor: 'transparent',
            borderRightColor: brand,
            borderBottomColor: brand,
            transform: [{ rotate: `${deg - 180 - 90}deg` }],
          }}
        />
      )}
      <Text style={{ fontSize: 28, fontWeight: '700', color: '#0f172a' }}>{consumed}</Text>
      <Text style={{ fontSize: 13, color: '#94a3b8' }}>/ {goal} cal</Text>
    </View>
  );
}

function MacroBar({
  label,
  consumed,
  goal,
  color,
  unit,
}: {
  label: string;
  consumed: number;
  goal: number;
  color: string;
  unit: string;
}) {
  const pct = Math.min(1, consumed / (goal || 1));
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '500' }}>{label}</Text>
        <Text style={{ fontSize: 13, color: '#64748b' }}>
          {consumed}{unit} / {goal}{unit}
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: '#f1f5f9', borderRadius: 999 }}>
        <View
          style={{
            height: 8,
            width: `${Math.round(pct * 100)}%`,
            backgroundColor: color,
            borderRadius: 999,
          }}
        />
      </View>
    </View>
  );
}
