'use client';

import { useState } from 'react';
import { cn } from '@vaqt/ui/lib/utils';

const STARS = [1, 2, 3, 4, 5];

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(
        'h-6 w-6 transition-colors',
        filled
          ? 'fill-amber-400 text-amber-400'
          : 'fill-none text-muted-foreground',
      )}
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1 1 5.79-5.21-2.74-5.2 2.74 1-5.79-4.22-4.1 5.82-.85L12 3.5z"
      />
    </svg>
  );
}

/**
 * Read-only display of a rating (profile/review cards) — pass `readOnly`.
 * Interactive picker (review submission form) — omit it and pass `onChange`.
 */
export function StarRating({
  value,
  onChange,
  readOnly = false,
  ariaLabel,
}: {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  ariaLabel?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (readOnly) {
    return (
      <div
        className="flex items-center gap-0.5"
        role="img"
        aria-label={ariaLabel}
      >
        {STARS.map((star) => (
          <StarIcon key={star} filled={star <= Math.round(value)} />
        ))}
      </div>
    );
  }

  const displayValue = hovered ?? value;

  return (
    <div
      className="flex items-center gap-0.5"
      role="radiogroup"
      aria-label={ariaLabel}
      onMouseLeave={() => {
        setHovered(null);
      }}
    >
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={String(star)}
          className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onMouseEnter={() => {
            setHovered(star);
          }}
          onFocus={() => {
            setHovered(star);
          }}
          onBlur={() => {
            setHovered(null);
          }}
          onClick={() => onChange?.(star)}
        >
          <StarIcon filled={star <= displayValue} />
        </button>
      ))}
    </div>
  );
}
