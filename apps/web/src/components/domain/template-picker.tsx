'use client';

import { CARD_TEMPLATES, type CardTemplate } from '@vaqt/shared';

import { BusinessCard } from '@/components/domain/business-card';
import { fa } from '@/messages/fa';

export function TemplatePicker({
  value,
  onChange,
  displayName,
  headline,
}: {
  value: CardTemplate;
  onChange: (t: CardTemplate) => void;
  displayName: string;
  headline: string;
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-3">
      {CARD_TEMPLATES.map((tpl) => {
        const active = value === tpl;
        return (
          <div
            key={tpl}
            role="radio"
            aria-checked={active}
            tabIndex={0}
            onClick={() => {
              onChange(tpl);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange(tpl);
              }
            }}
            className={`cursor-pointer rounded-2xl border-2 p-2 transition-colors ${
              active
                ? 'border-primary bg-primary/5'
                : 'border-transparent hover:border-border'
            }`}
          >
            <div className="pointer-events-none">
              <BusinessCard
                template={tpl}
                displayName={displayName || fa.editor.displayName}
                headline={headline || null}
                displayUrl={null}
                qrValue={null}
                phone={null}
                city={null}
                interactive={false}
              />
            </div>
            <p className="mt-1.5 text-center text-xs">
              {fa.cardEditPage.templates[tpl]}
            </p>
          </div>
        );
      })}
    </div>
  );
}
