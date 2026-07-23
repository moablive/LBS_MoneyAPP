self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'MoneyAPP', body: '', url: '/' };
  try {
    data = { ...data, ...event.data?.json() };
  } catch {
    /* payload não-JSON — usa defaults */
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo/pwa-192x192.png',
      badge: '/logo/pwa-192x192.png',
      data: { url: data.url },
      tag: `moneyapp-${Date.now()}`,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
