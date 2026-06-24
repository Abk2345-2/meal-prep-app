'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type MealEntry = { id: string; source: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; cooked_at: string };
type DayLog = { date: string; calories: number; meals: MealEntry[] };

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [history, setHistory] = useState<DayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.nutritionHistory(30)
      .then((d) => setHistory(d.history))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function removeMeal(mealId: string) {
    setRemoving(mealId);
    try {
      await api.deleteMealLog(mealId);
      const d = await api.nutritionHistory(30);
      setHistory(d.history);
    } finally {
      setRemoving(null);
    }
  }

  function handleSignOut() {
    logout();
    router.replace('/login');
  }

  const totalDays = history.length;
  const avgCalories = totalDays
    ? Math.round(history.reduce((s, d) => s + d.calories, 0) / totalDays)
    : 0;
  const totalMeals = history.reduce((s, d) => s + d.meals.length, 0);

  // First letter of name as avatar fallback
  const initials = user?.name?.charAt(0).toUpperCase() ?? '?';

  return (
    <main className="mx-auto max-w-md pb-12">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-700 to-slate-900 p-5 text-white">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20"
          >
            ←
          </button>
          <h1 className="text-xl font-bold">Profile</h1>
          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="flex h-9 items-center gap-1.5 rounded-full bg-white/20 px-3 text-sm font-medium transition hover:bg-white/30 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>

        {/* Google profile */}
        <div className="mt-5 flex items-center gap-4">
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-full ring-2 ring-white/30"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-2xl font-bold">
              {initials}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold">{user?.name ?? 'You'}</p>
            <p className="text-sm text-white/70">{user?.email ?? ''}</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/15 py-2">
            <p className="text-xl font-bold">{totalDays}</p>
            <p className="text-xs text-white/70">Active days</p>
          </div>
          <div className="rounded-xl bg-white/15 py-2">
            <p className="text-xl font-bold">{totalMeals}</p>
            <p className="text-xs text-white/70">Meals logged</p>
          </div>
          <div className="rounded-xl bg-white/15 py-2">
            <p className="text-xl font-bold">{avgCalories}</p>
            <p className="text-xs text-white/70">Avg cal/day</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <h2 className="mb-3 text-base font-semibold">📋 Calorie log — last 30 days</h2>

        {loading && <p className="py-10 text-center text-slate-400">Loading…</p>}

        {!loading && history.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">No meals logged yet. Cook something!</p>
        )}

        <div className="space-y-3">
          {history.map((day) => {
            const isOpen = expandedDay === day.date;
            return (
              <div key={day.date} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <button
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() => setExpandedDay(isOpen ? null : day.date)}
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      {new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-xs text-slate-400">{day.meals.length} meal{day.meals.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                      {day.calories} cal
                    </span>
                    <span className="text-slate-400">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <ul className="border-t border-slate-100">
                    {day.meals.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between px-4 py-3 text-sm odd:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-800">{m.source}</p>
                          <p className="text-xs text-slate-400">
                            {m.calories} cal · P {m.protein_g}g · C {m.carbs_g}g · F {m.fat_g}g
                            &nbsp;·&nbsp;
                            {new Date(m.cooked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          onClick={() => removeMeal(m.id)}
                          disabled={removing === m.id}
                          className="ml-3 shrink-0 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-400 transition hover:bg-red-50 disabled:opacity-40"
                        >
                          {removing === m.id ? '…' : 'Remove'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
