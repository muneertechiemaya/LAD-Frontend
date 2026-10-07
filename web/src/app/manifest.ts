import type { MetadataRoute } from 'next';

/**
 * Web app manifest — makes Mr LAD installable ("Add to Home Screen") on
 * Android and iOS, which is also what iOS requires before it allows Web Push.
 * Served by Next.js at /manifest.webmanifest and linked automatically.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Mr LAD',
    short_name: 'Mr LAD',
    description: 'Your AI sales employee — leads, replies and campaigns in your pocket.',
    start_url: '/overview?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000724',
    theme_color: '#0B1957',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press the home-screen icon (Android) to jump straight in.
    shortcuts: [
      { name: 'Conversations', short_name: 'Inbox', url: '/conversations', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Campaigns', url: '/campaigns', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Notification settings', short_name: 'Alerts', url: '/settings?tab=notifications', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
