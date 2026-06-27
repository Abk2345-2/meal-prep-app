'use client';

import { useRouter } from 'next/navigation';
import type { GamificationSummary, TodayNutrition } from '@nuskhaa/shared';
import { useAuth } from '@/lib/auth-context';
import { PushBell } from '@/components/PushBell';
import { useLanguage } from '@/lib/useLanguage';

export function StatsHeader({
  nutrition,
  game,
  onShare,
}: {
  nutrition: TodayNutrition | null;
  game: GamificationSummary | null;
  onShare: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { lang, setLang, languages } = useLanguage();
  const consumed = nutrition?.totals.calories ?? 0;
  const goal = nutrition?.goal.daily_calories ?? 2000;
  const pct = Math.min(100, Math.round((consumed / goal) * 100));

  return (
    <header className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-5 text-white shadow-sm">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/profile')} className="text-left">
          <h1 className="text-xl font-bold">Nuskhaa</h1>
          <p className="text-sm text-white/80">Never let anything go to waste.</p>
        </button>
        <div className="flex items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Parameters<typeof setLang>[0])}
            className="rounded-lg bg-white/20 px-2 py-1 text-xs text-white backdrop-blur focus:outline-none"
            aria-label="Select language"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code} className="text-slate-800 bg-white">
                {l.label}
              </option>
            ))}
          </select>
          <PushBell />
          <button
            onClick={onShare}
            className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium backdrop-blur"
          >
            Share 📤
          </button>
          <button
            onClick={() => router.push('/profile')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 overflow-hidden"
            aria-label="Profile"
          >
            {user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt={user.name} className="h-9 w-9 object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-lg">👤</span>
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-5">
        <CalorieRing pct={pct} consumed={consumed} goal={goal} />
        {/* Streak block — tap to open gamification detail */}
        <button
          className="flex-1 text-left"
          onClick={() => router.push('/gamification')}
        >
          <div className="flex items-center gap-2 text-lg font-semibold">
            🔥 {game?.streak.current_streak ?? 0}-day streak
          </div>
          <p className="text-sm text-white/80">{game?.total_points ?? 0} points</p>
          {game?.next_reward && (
            <p className="mt-1 text-xs text-white/70">
              Next: {game.next_reward.title} at {game.next_reward.points_needed} pts
            </p>
          )}
          <p className="mt-1 text-xs text-white/50">Tap to see details →</p>
        </button>
      </div>
    </header>
  );
}

function CalorieRing({ pct, consumed, goal }: { pct: number; consumed: number; goal: number }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-bold leading-none">{consumed}</span>
        <span className="text-[10px] text-white/80">/ {goal} cal</span>
      </div>
    </div>
  );
}
