'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, SunMoon } from 'lucide-react';

import { Button } from '@vaqt/ui/components/ui/button';

import { fa } from '@/messages/fa';

const CYCLE = ['light', 'dark', 'system'] as const;
type ThemeChoice = (typeof CYCLE)[number];

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return CYCLE.includes(value as ThemeChoice);
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // next-themes only knows the real theme after mount (it reads
  // localStorage/matchMedia client-side) — rendering its value before that
  // would mismatch the server-rendered markup. A fixed-size placeholder
  // avoids a layout shift once it resolves.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="size-8" aria-hidden="true" />;
  }

  const current: ThemeChoice = isThemeChoice(theme) ? theme : 'system';
  const Icon = current === 'light' ? Sun : current === 'dark' ? Moon : SunMoon;
  const next: ThemeChoice = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
  const label = fa.appShell.themeToggle.switchTo(fa.appShell.themeToggle[next]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => {
        setTheme(next);
      }}
      aria-label={label}
      title={label}
    >
      <Icon className="size-4" aria-hidden="true" />
    </Button>
  );
}
