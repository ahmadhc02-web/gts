self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle notification click to focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If we have a window, focus it
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Listener for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Listener for background push events (Requires FCM/Push Server)
self.addEventListener('push', (event) => {
  let data = { title: 'GTS System Alert', body: 'New operational activity detected.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'GTS System Alert', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/vite.svg',
    badge: '/vite.svg',
    vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40],
    data: { url: '/' },
    tag: 'gts-push-alert',
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'View' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
