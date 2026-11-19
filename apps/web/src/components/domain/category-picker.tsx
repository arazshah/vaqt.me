'use client';

import { Check } from 'lucide-react';
import { CARD_CATEGORIES, type CardCategory } from '@vaqt/shared';

import { CATEGORY_THEMES } from '@/lib/card-themes';
import { fa } from '@/messages/fa';

export function CategoryPicker({
  value,
  onChange,
}: {
  value: CardCategory | null;
  onChange: (c: CardCategory | null) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={fa.editor.category}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {CARD_CATEGORIES.map((c) => {
        const th = CATEGORY_THEMES[c];
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              onChange(active ? null : c);
            }}
            className={`flex items-center gap-2 rounded-xl border p-2 text-start text-sm transition-colors ${
              active
                ? 'border-primary bg-primary/10'
                : 'hover:border-primary/60'
            }`}
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
              style={{
                background: `linear-gradient(135deg, ${th.from}, ${th.to})`,
              }}
              aria-hidden="true"
            >
              {active ? <Check className="size-4" /> : null}
            </span>
            <span className="leading-tight">{fa.categories[c].label}</span>
          </button>
        );
      })}
    </div>
  );
}
