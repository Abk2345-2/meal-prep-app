import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppData } from '../../lib/useAppData';
import { api } from '../../lib/api';

const brand = '#16a34a';

export default function YouScreen() {
  const { game, refreshStats } = useAppData();
  const [sharing, setSharing] = useState(false);

  const streak = game?.streak.current_streak ?? 0;
  const longest = game?.streak.longest_streak ?? 0;
  const points = game?.total_points ?? 0;
  const nextReward = game?.next_reward ?? null;

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

  // Build 7-day streak visual (last 7 days, last = today).
  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
  });
  const activeDays = Math.min(streak, 7);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#0f172a' }}>🔥 You</Text>

        {/* Streak card */}
        <View
          style={{
            background: brand,
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
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: '#fff',
              textAlign: 'center',
              marginTop: 2,
            }}
          >
            day streak
          </Text>
          <Text
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 4 }}
          >
            Longest: {longest} days
          </Text>

          {/* 7-day dot row */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 20,
              paddingHorizontal: 8,
            }}
          >
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
                    <Text
                      style={{ fontSize: 14, color: filled ? brand : 'rgba(255,255,255,0.6)' }}
                    >
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 13, color: '#94a3b8', fontWeight: '500' }}>
                Total points
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#0f172a' }}>
                {points} pts
              </Text>
            </View>
            {nextReward && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>Next reward</Text>
                <Text
                  style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', textAlign: 'right' }}
                  numberOfLines={1}
                >
                  {nextReward.title}
                </Text>
                <Text style={{ fontSize: 12, color: brand }}>
                  {nextReward.points_needed - points} pts to go
                </Text>
              </View>
            )}
          </View>

          {nextReward && (
            <View style={{ marginTop: 14 }}>
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}
              >
                <Text style={{ fontSize: 12, color: '#64748b' }}>
                  {points} / {nextReward.points_needed} pts
                </Text>
                <Text style={{ fontSize: 12, color: brand }}>
                  {Math.round((points / nextReward.points_needed) * 100)}%
                </Text>
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
              <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                {nextReward.description}
              </Text>
            </View>
          )}
        </View>

        {/* Point actions legend */}
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
            How to earn points
          </Text>
          {[
            { action: 'Log pantry',      pts: '+10 pts', emoji: '🥦' },
            { action: 'Cook a meal',     pts: '+15 pts', emoji: '🍳' },
            { action: 'Hit calorie goal',pts: '+20 pts', emoji: '🎯' },
            { action: 'Avoid food waste',pts: '+25 pts', emoji: '♻️' },
            { action: 'Share your story',pts: '+10 pts', emoji: '📤' },
            { action: 'Refer a friend',  pts: '+50 pts', emoji: '🤝' },
          ].map(({ action, pts, emoji }) => (
            <View
              key={action}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 14, color: '#334155' }}>
                {emoji}  {action}
              </Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}
