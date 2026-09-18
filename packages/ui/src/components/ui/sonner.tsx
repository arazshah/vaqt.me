'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react';

const VALID_THEMES = ['light', 'dark', 'system'] as const;

const Toaster = ({ ...props }: ToasterProps) => {
  // next-themes types `theme` as a bare `string` (it supports arbitrary
  // custom theme names) — narrow it to what sonner actually accepts.
  const { theme: rawTheme } = useTheme();
  const theme: ToasterProps['theme'] = VALID_THEMES.includes(
    rawTheme as (typeof VALID_THEMES)[number],
  )
    ? (rawTheme as ToasterProps['theme'])
    : 'system';

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
