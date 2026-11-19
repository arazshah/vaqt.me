import Link from 'next/link';

import { Button } from '@vaqt/ui/components/ui/button';

import { AppShell } from '@/components/app-shell';
import { fa } from '@/messages/fa';

const t = fa.adminSetupPage;

/** How to sign in as the built-in "admin" account (nothing to submit here). */
export default function AdminSetupPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-lg flex-col gap-4 py-8">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <ol className="flex list-decimal flex-col gap-2 ps-5 text-sm leading-7">
          {t.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          {t.note}
        </p>
        <Button asChild className="self-start">
          <Link href="/login">{t.goLogin}</Link>
        </Button>
      </div>
    </AppShell>
  );
}
