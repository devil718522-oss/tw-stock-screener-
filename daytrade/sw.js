/* 史塔克交易助手：只負責系統通知（不做快取，以免頁面被舊檔卡住） */
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    for (const c of list) {
      if (c.url && c.url.indexOf('daytrade') !== -1 && 'focus' in c) return c.focus();
    }
    if (clients.openWindow) return clients.openWindow('./');
  }));
});
