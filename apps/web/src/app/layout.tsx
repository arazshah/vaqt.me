import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DirectionProvider, ThemeProvider } from '@vaqt/ui';
import { TooltipProvider } from '@vaqt/ui/components/ui/tooltip';
import { Toaster } from '@vaqt/ui/components/ui/sonner';
import { vazirmatn } from '@/lib/fonts';
import { AuthProvider } from '@/lib/auth-context';
import { WEB_ORIGIN } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(WEB_ORIGIN),
  title: 'Vaqt.me — چند دقیقه از وقت یک آدمِ درست',
  description: 'بازار دقیقه‌های انسانی، بدون واسطه در معامله',
};

// themeColor/colorScheme moved out of Metadata into a dedicated Viewport
// export as of Next.js 14 — keeping it in `metadata` above silently no-ops.
// Two themeColor entries (one per prefers-color-scheme) let the browser
// chrome (address bar, etc.) follow the resolved theme even though this
// is a static server-rendered export — ThemeProvider's own script handles
// the actual .dark class on <html>.
// Exact --background token values (packages/ui/src/styles/globals.css),
// computed via oklchStringToLinearRgb — not eyeballed.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fefdfb' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0d14' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={vazirmatn.variable}
      // next-themes needs to set the .dark class on this element before
      // hydration to avoid a flash of the wrong theme — suppressHydrationWarning
      // silences the (expected, harmless) class-attribute mismatch that
      // causes between server and client markup.
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <DirectionProvider dir="rtl">
            <TooltipProvider>
              <AuthProvider>
                {children}
                <Toaster />
              </AuthProvider>
            </TooltipProvider>
          </DirectionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
