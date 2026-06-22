'use client';

import type { GamificationSummary, TodayNutrition } from '@pantrytoplate/shared';

// StatsHeader shows the two primary motivators at a glance: today's calorie ring
// and the current streak + points, with the next reward to work toward.
export function StatsHeader({
  nutrition,
  game,
  onShare,
}: {
  nutrition: TodayNutrition | null;
  game: GamificationSummary | null;
  onShare: () => void;
}) {
  const consumed = nutrition?.totals.calories ?? 0;
  const goal = nutrition?.goal.daily_calories ?? 2000;
  const pct = Math.min(100, Math.round((consumed / goal) * 100));

  return (
    <header className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-5 text-white shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">PantryToPlate</h1>
          <p className="text-sm text-white/80">Cook what you have.</p>
        </div>
        <button
          onClick={onShare}
          className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium backdrop-blur"
        >
          Share 📤
        </button>
      </div>

      <div className="mt-4 flex items-center gap-5">
        <CalorieRing pct={pct} consumed={consumed} goal={goal} />
        <div className="flex-1">
          <div className="flex items-center gap-2 text-lg font-semibold">
            🔥 {game?.streak.current_streak ?? 0}-day streak
          </div>
          <p className="text-sm text-white/80">{game?.total_points ?? 0} points</p>
          {game?.next_reward && (
            <p className="mt-1 text-xs text-white/70">
              Next: {game.next_reward.title} at {game.next_reward.points_needed} pts
            </p>
          )}
        </div>
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
