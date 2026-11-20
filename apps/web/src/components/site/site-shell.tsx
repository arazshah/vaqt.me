import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import './site.css';

/** Chrome for public marketing pages (landing, guide). */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
