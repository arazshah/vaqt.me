'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileEdit, Sparkles } from 'lucide-react';

import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { AiWizard } from '@/components/domain/ai-wizard';
import { useAuth } from '@/lib/auth-context';
import { fa } from '@/messages/fa';

export default function NewRequestAiPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <AppShell>
        <Skeleton className="h-96 w-full max-w-lg" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-6 text-primary" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-semibold">{fa.aiWizardPage.title}</h1>
          <p className="text-sm text-muted-foreground">
            {fa.aiWizardPage.subtitle}
          </p>
          <Link
            href="/requests/new"
            className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-primary no-underline transition-colors hover:bg-accent"
          >
            <FileEdit className="size-3.5" aria-hidden="true" />
            {fa.newRequestPage.manualLink}
          </Link>
        </div>
        <AiWizard />
      </div>
    </AppShell>
  );
}
