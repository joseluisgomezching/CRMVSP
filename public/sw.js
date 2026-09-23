// Service Worker para VSP Desk 2.0 - Notificaciones de Windows y segundo plano
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Cuando el usuario hace clic en la notificación de Windows
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Traer al frente la ventana de la aplicación o abrirla si está cerrada/minimizada
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Escucha mensajes desde la aplicación web principal
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const finalOptions = {
      body: options?.body || '',
      icon: options?.icon || '/icon-192.png',
      badge: options?.badge || '/icon-192.png',
      tag: options?.tag || 'vsp-notification-' + Date.now(),
      requireInteraction: true, // Notificación persistente en Windows hasta que el usuario interactúa
      renotify: true,
      silent: false,
      vibrate: [250, 100, 250],
      data: options?.data || { url: '/' }
    };
    event.waitUntil(self.registration.showNotification(title, finalOptions));
  }
});
