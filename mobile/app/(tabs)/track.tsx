import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppData } from '../../lib/useAppData';
import { api } from '../../lib/api';

const brand = '#16a34a';

export default function TrackScreen() {
  const { nutrition, refreshStats } = useAppData();

  const [calories, setCalories] = useState('');
  const [source, setSource] = useState('');
  const [logging, setLogging] = useState(false);

  const consumed = nutrition?.totals.calories ?? 0;
  const goal = nutrition?.goal.daily_calories ?? 2000;
  const pct = Math.min(1, consumed / goal);

  const proteinConsumed = nutrition?.totals.protein_g ?? 0;
  const proteinGoal = nutrition?.goal.protein_g ?? 150;
  const carbsConsumed = nutrition?.totals.carbs_g ?? 0;
  const carbsGoal = nutrition?.goal.carbs_g ?? 250;
  const fatConsumed = nutrition?.totals.fat_g ?? 0;
  const fatGoal = nutrition?.goal.fat_g ?? 65;

  async function logMeal() {
    const cal = parseInt(calories, 10);
    if (!cal || cal <= 0) return;
    setLogging(true);
    try {
      await api.logMeal({ source: source.trim() || 'Quick log', calories: cal });
      await api.sendEvent('cook_meal');
      setCalories('');
      setSource('');
      await refreshStats();
    } finally {
      setLogging(false);
    }
  }

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
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderTopColor: '#f1f5f9',
                }}
              >
                <Text style={{ fontSize: 14, color: '#334155', flex: 1 }}>{m.source}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#15803d' }}>
                  {m.calories} cal
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Simple donut-style ring using a thick border + clip trick.
// No extra dependencies needed.
function CalorieRing({ pct, consumed, goal }: { pct: number; consumed: number; goal: number }) {
  const size = 160;
  const thickness = 14;
  // We fake the arc by layering two semicircle clips.
  // For simplicity we render a progress-filled ring via a border + rotation approach.
  // The "ring" is a View with large borderRadius (circle), with a colored arc overlay.
  const deg = Math.round(pct * 360);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Track (gray full circle) */}
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
      {/* Progress fill — left half */}
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
      {/* Progress fill — right half (only shown when > 180°) */}
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
          {consumed}
          {unit} / {goal}
          {unit}
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
