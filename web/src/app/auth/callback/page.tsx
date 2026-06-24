'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token  = params.get('token');
    const id     = params.get('id')     ?? '';
    const name   = params.get('name')   ?? '';
    const email  = params.get('email')  ?? '';
    const avatar = params.get('avatar') ?? '';

    if (!token) {
      router.replace('/login?error=no_token');
      return;
    }

    // Persist both token and user so AuthProvider can restore the session
    // synchronously on the next page load — no loading flash, no redirect loop.
    localStorage.setItem('ptp_token', token);
    localStorage.setItem('ptp_user', JSON.stringify({ id, name, email, avatar }));

    router.replace('/');
  }, [params, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-gray-500">Signing you in…</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-gray-500">Signing you in…</p>
        </main>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
