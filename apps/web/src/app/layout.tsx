import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vaqt.me — چند دقیقه از وقت یک آدمِ درست',
  description: 'بازار دقیقه‌های انسانی، بدون واسطه در معامله',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
