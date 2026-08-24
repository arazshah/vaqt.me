'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{fa.aiWizardPage.title}</h1>
          <Link
            href="/requests/new"
            className="text-sm text-primary hover:underline"
          >
            {fa.newRequestPage.manualLink}
          </Link>
        </div>
        <AiWizard />
      </div>
    </AppShell>
  );
}
