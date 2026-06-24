'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type ActionDetail = { action: string; points: number; created_at: string };
type DayActivity = { date: string; points: number; actions: ActionDetail[] };
type Reward = { id: string; title: string; description: string; points_needed: number; unlocked: boolean };

const ACTION_LABELS: Record<string, string> = {
  log_pantry:  '🛒 Added groceries',
  cook_meal:   '🍳 Cooked a meal',
  hit_goal:    '🎯 Hit calorie goal',
  avoid_waste: '♻️ Avoided food waste',
  share:       '📤 Shared activity',
  refer:       '👥 Referred a friend',
};

export default function GamificationPage() {
  const router = useRouter();
  const [data, setData] = useState<{
    history: DayActivity[];
    streak: { current_streak: number; longest_streak: number };
    total_points: number;
    rewards: Reward[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.gamificationHistory(30)
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="mx-auto max-w-md p-4"><p className="py-16 text-center text-slate-400">Loading…</p></main>;

  const { history, streak, total_points, rewards } = data!;
  const unlocked = rewards.filter((r) => r.unlocked);
  const next = rewards.find((r) => !r.unlocked);

  return (
    <main className="mx-auto max-w-md pb-12">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand to-brand-dark p-5 text-white">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white">←</button>
          <h1 className="text-xl font-bold">Activity & Rewards</h1>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-white/15 py-3">
            <p className="text-2xl font-bold">{streak.current_streak}</p>
            <p className="text-xs text-white/80">Day streak</p>
          </div>
          <div className="rounded-xl bg-white/15 py-3">
            <p className="text-2xl font-bold">{total_points}</p>
            <p className="text-xs text-white/80">Total points</p>
          </div>
          <div className="rounded-xl bg-white/15 py-3">
            <p className="text-2xl font-bold">{streak.longest_streak}</p>
            <p className="text-xs text-white/80">Best streak</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {/* Next reward progress */}
        {next && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-base font-semibold">🎁 Next reward: {next.title}</h2>
            <p className="mb-2 text-xs text-slate-500">{next.description}</p>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-brand transition-all"
                style={{ width: `${Math.min(100, (total_points / next.points_needed) * 100).toFixed(1)}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-slate-400">{total_points} / {next.points_needed} pts</p>
          </section>
        )}

        {/* Unlocked rewards */}
        {unlocked.length > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold">🏆 Unlocked</h2>
            <div className="space-y-2">
              {unlocked.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl bg-green-50 px-3 py-2">
                  <span className="text-lg">✅</span>
                  <div>
                    <p className="text-sm font-semibold text-green-800">{r.title}</p>
                    <p className="text-xs text-green-600">{r.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Day-wise activity */}
        <section>
          <h2 className="mb-3 text-base font-semibold">📅 Last 30 days</h2>
          {history.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">No activity yet — start cooking!</p>
          )}
          <div className="space-y-3">
            {history.map((day) => (
              <div key={day.date} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-slate-800">
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <span className="rounded-full bg-brand px-3 py-0.5 text-xs font-bold text-white">+{day.points} pts</span>
                </div>
                <ul className="space-y-1">
                  {day.actions.map((a, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{ACTION_LABELS[a.action] ?? a.action}</span>
                      <span className="text-xs text-slate-400">
                        +{a.points} · {new Date(a.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
