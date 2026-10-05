/*
 * Mr LAD service worker — Web Push only.
 *
 * Deliberately NO fetch handler and NO caching: the app is always online-first
 * and served with no-store headers, and a caching worker is how a web app ends
 * up serving yesterday's bundle. This worker exists to (1) receive push
 * messages when the app is closed and show them, and (2) open the right screen
 * when one is tapped.
 *
 * Payload (from LAD_backend core/pushNotifications/pushService.js):
 *   { kind, title, body, url, tag }
 */

self.addEventListener('install', () => {
  // Take over as soon as a new version is installed — there is no cache to migrate.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Mr LAD', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Mr LAD';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    // Same tag = replaces the previous alert (a burst of replies in one
    // conversation shows as one notification); renotify still buzzes.
    tag: data.tag || undefined,
    renotify: !!data.tag,
    timestamp: Date.now(),
    data: { url: sameOriginPath(data.url) },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(sameOriginPath(event.notification.data && event.notification.data.url), self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Prefer an already-open Mr LAD window: focus it and move it to the target.
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if ('navigate' in client) {
          try { await client.navigate(target); return; } catch (e) { /* fall through to openWindow */ }
        }
        client.postMessage({ type: 'lad:navigate', url: target });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});

/** Only ever open a path on this origin — a payload can never send the user off-site. */
function sameOriginPath(url) {
  // Resolve, then compare origins: a prefix check alone lets '/\\evil.com'
  // through, because the URL parser treats a backslash as a slash.
  if (typeof url !== 'string') return '/overview';
  try {
    const u = new URL(url, self.location.origin);
    return u.origin === self.location.origin ? u.pathname + u.search + u.hash : '/overview';
  } catch (e) {
    return '/overview';
  }
}
