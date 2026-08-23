import type { Metadata } from 'next';
import './globals.css';
import { DirectionProvider } from '@vaqt/ui';
import { TooltipProvider } from '@vaqt/ui/components/ui/tooltip';
import { Toaster } from '@vaqt/ui/components/ui/sonner';
import { vazirmatn } from '@/lib/fonts';
import { AuthProvider } from '@/lib/auth-context';

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
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body>
        <DirectionProvider dir="rtl">
          <TooltipProvider>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </TooltipProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
