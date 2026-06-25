import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSharedAppData as useAppData } from '../../lib/AppDataContext';
import { api } from '../../lib/api';
import { YouScreenSkeleton } from '../../components/LoadingScreen';

const brand = '#16a34a';

const ACTION_LABELS: Record<string, string> = {
  log_pantry:  '🛒 Added groceries',
  cook_meal:   '🍳 Cooked a meal',
  hit_goal:    '🎯 Hit calorie goal',
  avoid_waste: '♻️ Avoided food waste',
  share:       '📤 Shared activity',
  refer:       '👥 Referred a friend',
};

type ActionDetail = { action: string; points: number; created_at: string };
type DayActivity = { date: string; points: number; actions: ActionDetail[] };
type Reward = { id: string; title: string; description: string; points_needed: number; unlocked: boolean };

export default function YouScreen() {
  const { game, loading, refreshStats } = useAppData();
  const router = useRouter();
  const [sharing, setSharing] = useState(false);

  const [history, setHistory] = useState<DayActivity[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const streak = game?.streak.current_streak ?? 0;
  const longest = game?.streak.longest_streak ?? 0;
  const points = game?.total_points ?? 0;
  const nextReward = game?.next_reward ?? null;

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    api
      .gamificationHistory(30)
      .then((d) => {
        setHistory(d.history);
        setRewards(d.rewards);
      })
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onShare = useCallback(async () => {
    setSharing(true);
    try {
      const story = await api.story();
      await Share.share({ message: story.share_text });
      await api.sendEvent('share');
      await refreshStats();
    } catch {
      // user cancelled or error
    } finally {
      setSharing(false);
    }
  }, [refreshStats]);

  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
  });
  const activeDays = Math.min(streak, 7);

  const unlockedRewards = rewards.filter((r) => r.unlocked);

  if (loading) return <YouScreenSkeleton />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 26, fontWeight: '700', color: '#0f172a' }}>🔥 You</Text>
          <Pressable
            onPress={() => router.push('/profile')}
            style={{
              backgroundColor: '#f1f5f9',
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 7,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748b' }}>👤 Profile</Text>
          </Pressable>
        </View>

        {/* Streak card */}
        <View
          style={{
            backgroundColor: brand,
            borderRadius: 20,
            padding: 20,
            shadowColor: brand,
            shadowOpacity: 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Text style={{ fontSize: 40, fontWeight: '800', color: '#fff', textAlign: 'center' }}>
            🔥 {streak}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center', marginTop: 2 }}>
            day streak
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 4 }}>
            Longest: {longest} days
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 8 }}>
            {last7.map((day, i) => {
              const filled = i >= 7 - activeDays;
              return (
                <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      backgroundColor: filled ? '#fff' : 'rgba(255,255,255,0.25)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, color: filled ? brand : 'rgba(255,255,255,0.6)' }}>
                      {filled ? '✓' : '·'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Points + next reward */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 13, color: '#94a3b8', fontWeight: '500' }}>Total points</Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#0f172a' }}>{points} pts</Text>
            </View>
            {nextReward && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>Next reward</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', textAlign: 'right' }} numberOfLines={1}>
                  {nextReward.title}
                </Text>
                <Text style={{ fontSize: 12, color: brand }}>{nextReward.points_needed - points} pts to go</Text>
              </View>
            )}
          </View>

          {nextReward && (
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: '#64748b' }}>{points} / {nextReward.points_needed} pts</Text>
                <Text style={{ fontSize: 12, color: brand }}>{Math.round((points / nextReward.points_needed) * 100)}%</Text>
              </View>
              <View style={{ height: 8, backgroundColor: '#f1f5f9', borderRadius: 999 }}>
                <View
                  style={{
                    height: 8,
                    width: `${Math.min(100, Math.round((points / nextReward.points_needed) * 100))}%`,
                    backgroundColor: brand,
                    borderRadius: 999,
                  }}
                />
              </View>
              <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{nextReward.description}</Text>
            </View>
          )}
        </View>

        {/* Unlocked rewards */}
        {unlockedRewards.length > 0 && (
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#0f172a' }}>🏆 Unlocked</Text>
            {unlockedRewards.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fdf4', borderRadius: 12, padding: 10 }}>
                <Text style={{ fontSize: 18 }}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#166534' }}>{r.title}</Text>
                  <Text style={{ fontSize: 12, color: '#15803d' }}>{r.description}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Point actions legend */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#0f172a' }}>How to earn points</Text>
          {[
            { action: 'Log pantry',       pts: '+10 pts', emoji: '🥦' },
            { action: 'Cook a meal',      pts: '+15 pts', emoji: '🍳' },
            { action: 'Hit calorie goal', pts: '+20 pts', emoji: '🎯' },
            { action: 'Avoid food waste', pts: '+25 pts', emoji: '♻️' },
            { action: 'Share your story', pts: '+10 pts', emoji: '📤' },
            { action: 'Refer a friend',   pts: '+50 pts', emoji: '🤝' },
          ].map(({ action, pts, emoji }) => (
            <View key={action} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: '#334155' }}>{emoji}  {action}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: brand }}>{pts}</Text>
            </View>
          ))}
        </View>

        {/* Share story */}
        <Pressable
          onPress={onShare}
          disabled={sharing}
          style={{
            backgroundColor: sharing ? '#dcfce7' : brand,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Text style={{ color: sharing ? '#166534' : '#fff', fontSize: 16, fontWeight: '700' }}>
            {sharing ? 'Sharing…' : '📤  Share your story  +10 pts'}
          </Text>
        </Pressable>

        {/* 30-day activity history */}
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 10 }}>
            📅 Last 30 days
          </Text>

          {historyLoading && (
            <Text style={{ textAlign: 'center', color: '#94a3b8', paddingVertical: 16 }}>Loading…</Text>
          )}

          {!historyLoading && history.length === 0 && (
            <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, paddingVertical: 16 }}>
              No activity yet — start cooking!
            </Text>
          )}

          {history.map((day) => (
            <View
              key={day.date}
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 14,
                marginBottom: 10,
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a' }}>
                  {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
                <View style={{ backgroundColor: brand, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>+{day.points} pts</Text>
                </View>
              </View>
              {day.actions.map((a, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 13, color: '#475569' }}>
                    {ACTION_LABELS[a.action] ?? a.action}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                    +{a.points} · {new Date(a.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
