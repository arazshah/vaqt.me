'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Skeleton } from '@vaqt/ui/components/ui/skeleton';

import { AppShell } from '@/components/app-shell';
import { RequestForm } from '@/components/domain/request-form';
import { useAuth } from '@/lib/auth-context';
import { fa } from '@/messages/fa';

export default function NewRequestPage() {
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
        <h1 className="mb-6 text-2xl font-semibold">
          {fa.newRequestPage.title}
        </h1>
        <RequestForm />
      </div>
    </AppShell>
  );
}
