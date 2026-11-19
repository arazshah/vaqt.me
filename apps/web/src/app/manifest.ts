import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'وقت من — کارت ویزیت آنلاین',
    short_name: 'وقت من',
    description: 'کارت ویزیت آنلاین و رزرو وقت برای متخصص‌ها',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#4338ca',
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
