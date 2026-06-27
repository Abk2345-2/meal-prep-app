'use client';

import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="flex w-full max-w-3xl flex-col gap-8 md:flex-row md:items-center">
        {/* Features section - left on md+ */}
        <div className="flex-1 space-y-6 text-center md:text-left">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nuskhaa</h1>
            <p className="mt-2 text-base text-gray-500">Never let anything go to waste.</p>
          </div>
          <ul className="space-y-4">
            <li className="flex items-center gap-3 md:justify-start justify-center">
              <span className="text-2xl">🥦</span>
              <span className="text-base text-gray-700">Track your pantry &amp; reduce food waste</span>
            </li>
            <li className="flex items-center gap-3 md:justify-start justify-center">
              <span className="text-2xl">🍳</span>
              <span className="text-base text-gray-700">Get recipes matched to what you have</span>
            </li>
            <li className="flex items-center gap-3 md:justify-start justify-center">
              <span className="text-2xl">🎬</span>
              <span className="text-base text-gray-700">Save recipes from Instagram, YouTube &amp; TikTok</span>
            </li>
            <li className="flex items-center gap-3 md:justify-start justify-center">
              <span className="text-2xl">❤️</span>
              <span className="text-base text-gray-700">Favorite recipes &amp; build your shopping list</span>
            </li>
            <li className="flex items-center gap-3 md:justify-start justify-center">
              <span className="text-2xl">🔗</span>
              <span className="text-base text-gray-700">Share recipes with friends and family</span>
            </li>
            <li className="flex items-center gap-3 md:justify-start justify-center">
              <span className="text-2xl">🔔</span>
              <span className="text-base text-gray-700">Get alerts before your food expires</span>
            </li>
            <li className="flex items-center gap-3 md:justify-start justify-center">
              <span className="text-2xl">📊</span>
              <span className="text-base text-gray-700">Log nutrition and hit your daily goals</span>
            </li>
            <li className="flex items-center gap-3 md:justify-start justify-center">
              <span className="text-2xl">🔥</span>
              <span className="text-base text-gray-700">Build streaks and earn rewards</span>
            </li>
          </ul>
        </div>

        {/* Sign-in card - right on md+ */}
        <div className="w-full max-w-sm mx-auto md:mx-0 rounded-2xl bg-white p-8 shadow-lg text-center space-y-6">
          <p className="text-sm font-semibold text-gray-700">Sign in to get started</p>

          <button
            onClick={login}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="text-xs text-gray-400">
            By continuing you agree to our terms of service.
          </p>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
