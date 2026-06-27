'use client';

import { useCallback, useRef, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://backend-nuskhaa.fly.dev';

type State = 'idle' | 'loading' | 'success' | 'error' | 'duplicate';

const FEATURES = [
  { emoji: '🥦', text: "Tell it what's in your kitchen — it finds the recipe" },
  { emoji: '🎬', text: 'Save recipes from Instagram Reels, YouTube Shorts &amp; TikTok' },
  { emoji: '❤️', text: 'Favorite recipes and add ingredients straight to your shopping list' },
  { emoji: '🔗', text: 'Share recipes with friends and family in one tap' },
  { emoji: '🔔', text: 'Get expiry alerts before food goes to waste' },
  { emoji: '🎙️', text: 'Add groceries by voice in Hindi, Tamil, Bengali + 19 more languages' },
  { emoji: '📊', text: 'Track calories and hit your nutrition goals daily' },
  { emoji: '🔥', text: 'Build streaks and unlock rewards for healthy habits' },
];

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setState('loading');
    try {
      const res = await fetch(`${API_BASE}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'poster' }),
      });
      if (res.ok) {
        setState('success');
        setEmail('');
      } else if (res.status === 409) {
        setState('duplicate');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }, [email]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Hero */}
      <div className="mx-auto max-w-lg px-6 pt-16 pb-10 text-center">
        <div className="mb-4 text-6xl">🍽️</div>
        <h1 className="text-4xl font-extrabold text-slate-900 leading-tight">
          Nuskhaa
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Never let anything go to waste.
        </p>
      </div>

      {/* Features */}
      <div className="mx-auto max-w-lg px-6 mb-10 space-y-3">
        {FEATURES.map(({ emoji, text }) => (
          <div key={text} className="flex items-start gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100">
            <span className="text-2xl mt-0.5">{emoji}</span>
            <p className="text-sm text-slate-700 leading-snug">{text}</p>
          </div>
        ))}
      </div>

      {/* Waitlist form */}
      <div className="mx-auto max-w-lg px-6 pb-20">
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8">
          {state === 'success' ? (
            <div className="text-center space-y-3">
              <div className="text-5xl">🎉</div>
              <h2 className="text-xl font-bold text-slate-900">You're on the list!</h2>
              <p className="text-sm text-slate-500">
                We'll email you the moment Nuskhaa launches. Tell your friends — the more the merrier.
              </p>
              <a
                href={`https://wa.me/?text=${encodeURIComponent('Join the waitlist for Nuskhaa — never let anything go to waste 🍽️ https://nuskhaa.app/waitlist')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green-500 px-5 py-3 text-sm font-semibold text-white hover:bg-green-600 transition"
              >
                📲 Share on WhatsApp
              </a>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Join the waitlist</h2>
              <p className="text-sm text-slate-500 mb-6">
                Be the first to know when we launch. Free, no spam.
              </p>
              <form onSubmit={submit} className="space-y-3">
                <input
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setState('idle'); }}
                  placeholder="your@email.com"
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                />
                {state === 'duplicate' && (
                  <p className="text-xs text-amber-600">✓ You're already on the list! We'll be in touch.</p>
                )}
                {state === 'error' && (
                  <p className="text-xs text-red-500">Something went wrong. Please try again.</p>
                )}
                <button
                  type="submit"
                  disabled={state === 'loading' || !email.trim()}
                  className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  {state === 'loading' ? 'Joining…' : 'Join waitlist →'}
                </button>
              </form>
              <p className="mt-4 text-center text-xs text-slate-400">
                No spam. Unsubscribe anytime.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
