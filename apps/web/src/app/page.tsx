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
import { Section } from '@vaqt/ui/components/section';

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
      <Section
        spacing="loose"
        className="relative isolate -mt-8 overflow-hidden rounded-3xl bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,var(--primary)_0%,transparent_60%)] before:absolute before:inset-0 before:-z-10 before:bg-background/94"
      >
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {fa.homePage.heroEyebrow}
          </span>
          <h1 className="max-w-2xl text-4xl font-heading font-bold text-foreground sm:text-6xl">
            {fa.homePage.heroTitle}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {fa.homePage.heroSubtitle}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/requests">{fa.homePage.ctaBrowse}</Link>
            </Button>
            {!loading && (
              <Button asChild size="lg" variant="outline">
                <Link href={user ? '/requests/new' : '/login'}>
                  {user
                    ? fa.homePage.ctaNewRequest
                    : fa.homePage.ctaLoginOrStart}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </Section>

      <Section spacing="tight" className="grid gap-4 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Icon className="size-5 text-primary" aria-hidden="true" />
              </span>
              <CardTitle className="pt-3">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </Section>
    </AppShell>
  );
}
