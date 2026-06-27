'use client';

import { usePushNotifications } from '@/lib/usePushNotifications';

export function PushBell() {
  const { supported, subscribed, subscribe, unsubscribe } = usePushNotifications();
  if (!supported) return null;

  return (
    <button
      onClick={subscribed ? unsubscribe : subscribe}
      title={subscribed ? 'Turn off expiry alerts' : 'Enable expiry alerts'}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg backdrop-blur transition hover:bg-white/30"
      aria-label={subscribed ? 'Unsubscribe from notifications' : 'Subscribe to notifications'}
    >
      {subscribed ? '🔔' : '🔕'}
    </button>
  );
}
