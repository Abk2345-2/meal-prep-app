// Nuskhaa service worker — handles web push notifications for expiry alerts.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nuskhaa', {
      body: data.body || 'Something in your pantry is expiring soon.',
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      data: data.data || {},
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
