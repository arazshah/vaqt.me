import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DirectionProvider, ThemeProvider } from '@vaqt/ui';
import { TooltipProvider } from '@vaqt/ui/components/ui/tooltip';
import { Toaster } from '@vaqt/ui/components/ui/sonner';
import { vazirmatn } from '@/lib/fonts';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeColorSync } from '@/components/theme-color-sync';
import { WEB_ORIGIN } from '@/lib/site';
import { DARK_THEME_COLOR, LIGHT_THEME_COLOR } from '@/lib/theme-colors';

export const metadata: Metadata = {
  metadataBase: new URL(WEB_ORIGIN),
  title: 'Vaqt.me — چند دقیقه از وقت یک آدمِ درست',
  description: 'بازار دقیقه‌های انسانی، بدون واسطه در معامله',
};

// themeColor/colorScheme moved out of Metadata into a dedicated Viewport
// export as of Next.js 14 — keeping it in `metadata` above silently no-ops.
// This static, per-prefers-color-scheme pair is only the pre-hydration/
// no-JS fallback — it can't react to an explicit in-app theme choice
// (setTheme()), only to OS preference. ThemeColorSync (mounted below)
// overwrites these same <meta> tags' content once the real resolved theme
// is known client-side, so a user who picks dark on a light-system device
// (or vice versa) still gets matching browser chrome.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: LIGHT_THEME_COLOR },
    { media: '(prefers-color-scheme: dark)', color: DARK_THEME_COLOR },
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
          <ThemeColorSync />
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
