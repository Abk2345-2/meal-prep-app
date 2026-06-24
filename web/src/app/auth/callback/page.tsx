'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const { setSession } = useAuth();

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

    // Hydrate auth context directly so user state is set before we navigate.
    // This prevents the home page seeing user=null and redirecting to /login.
    setSession(token, { id, name, email, avatar });
    router.replace('/');
  }, [params, router, setSession]);

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
