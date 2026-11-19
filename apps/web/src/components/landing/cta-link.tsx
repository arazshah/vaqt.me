'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';

/**
 * The main sign-up call to action. Signed-in visitors are sent to their own
 * card instead, so the page never asks someone with an account to register.
 */
export function CtaLink({
  label,
  mineLabel,
  className = 'lp-btn-primary',
}: {
  label: string;
  mineLabel: string;
  className?: string;
}) {
  const { user, loading } = useAuth();
  const mine = !loading && !!user;
  return (
    <Link href={mine ? '/card' : '/login?tab=register'} className={className}>
      {mine ? mineLabel : label}
      <ArrowLeft className="size-5" aria-hidden="true" />
    </Link>
  );
}
