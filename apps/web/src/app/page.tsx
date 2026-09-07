'use client';

import Link from 'next/link';
import { CalendarClock, MessageSquareText, ShieldCheck } from 'lucide-react';

import { Button } from '@vaqt/ui/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@vaqt/ui/components/ui/card';

import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { fa } from '@/messages/fa';

const features = [
  {
    icon: CalendarClock,
    title: fa.homePage.feature1Title,
    description: fa.homePage.feature1Description,
  },
  {
    icon: MessageSquareText,
    title: fa.homePage.feature2Title,
    description: fa.homePage.feature2Description,
  },
  {
    icon: ShieldCheck,
    title: fa.homePage.feature3Title,
    description: fa.homePage.feature3Description,
  },
];

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <AppShell>
      <section className="flex flex-col items-center gap-6 py-12 text-center">
        <h1 className="max-w-2xl text-4xl font-heading font-medium text-brand-900 sm:text-5xl">
          {fa.homePage.heroTitle}
        </h1>
        <p className="max-w-xl text-lg text-text-muted">
          {fa.homePage.heroSubtitle}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button asChild size="lg">
            <Link href="/requests">{fa.homePage.ctaBrowse}</Link>
          </Button>
          {!loading && (
            <Button asChild size="lg" variant="outline">
              <Link href={user ? '/requests/new' : '/login'}>
                {user ? fa.homePage.ctaNewRequest : fa.homePage.ctaLoginOrStart}
              </Link>
            </Button>
          )}
        </div>
      </section>

      <section className="grid gap-4 pb-12 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="size-6 text-brand-500" aria-hidden="true" />
              <CardTitle className="pt-2">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </AppShell>
  );
}
