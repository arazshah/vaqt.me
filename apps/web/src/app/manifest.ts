import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vaqt.me — بازار دقیقه‌های انسانی',
    short_name: 'Vaqt.me',
    description: 'بازار دقیقه‌های انسانی، بدون واسطه در معامله',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#2E2547',
    lang: 'fa',
    dir: 'rtl',
    icons: [
      { src: '/icons/icon-192', sizes: '192x192', type: 'image/png' },
      {
        src: '/icons/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
