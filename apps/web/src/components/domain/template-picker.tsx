'use client';

import { Check } from 'lucide-react';
import {
  CARD_FIELDS,
  CARD_TEMPLATES,
  CATEGORY_TEMPLATE,
  type CardCategory,
  type CardField,
  type CardTemplate,
} from '@vaqt/shared';

import { Checkbox } from '@vaqt/ui/components/ui/checkbox';

import {
  BusinessCard,
  type BusinessCardProps,
} from '@/components/domain/business-card';
import { fa } from '@/messages/fa';

type Sample = Omit<
  BusinessCardProps,
  'template' | 'initialFlipped' | 'interactive' | 'fields'
>;

/**
 * The card designer: a live, flippable preview of the chosen design with the
 * owner's real details, the six designs to pick from, and the switches for
 * what is printed on the card.
 */
export function TemplatePicker({
  value,
  onChange,
  sample,
  fields,
  onFieldsChange,
  category = null,
}: {
  category?: CardCategory | null;
  value: CardTemplate;
  onChange: (t: CardTemplate) => void;
  sample: Sample;
  fields?: CardField[];
  onFieldsChange?: (f: CardField[]) => void;
}) {
  const t = fa.editor;
  const names = fa.cardEditPage.templates;
  const notes = fa.cardEditPage.templateNotes;
  const displayName = sample.displayName || t.displayName;
  const suggested = category ? CATEGORY_TEMPLATE[category] : null;

  const renderGrid = (list: readonly CardTemplate[], label: string) => (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {list.map((tpl) => {
        const active = value === tpl;
        return (
          <div
            key={tpl}
            role="radio"
            aria-checked={active}
            aria-label={names[tpl]}
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
            className={`relative cursor-pointer rounded-2xl border-2 p-2 transition-colors ${
              active
                ? 'border-primary bg-primary/5'
                : 'border-transparent hover:border-border'
            }`}
          >
            <div className="pointer-events-none">
              <BusinessCard
                template={tpl}
                {...sample}
                displayName={displayName}
                qrValue={null}
                fields={fields}
                interactive={false}
              />
            </div>
            <p className="mt-2 text-center text-sm font-semibold">
              {names[tpl]}
            </p>
            <p className="text-center text-[11px] leading-4 text-muted-foreground">
              {notes[tpl]}
            </p>
            {active ? (
              <span className="absolute -top-2 -end-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                <Check className="size-4" aria-hidden="true" />
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="mx-auto w-full max-w-sm">
          <BusinessCard
            key={value}
            template={value}
            {...sample}
            displayName={displayName}
            fields={fields}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {t.cardPreviewHelp}
        </p>
      </div>

      {suggested ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{fa.cardEditPage.suggested}</h3>
          {renderGrid([suggested], fa.cardEditPage.suggested)}
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        {suggested ? (
          <h3 className="text-sm font-semibold">
            {fa.cardEditPage.allDesigns}
          </h3>
        ) : null}
        {renderGrid(
          CARD_TEMPLATES.filter((x) => x !== suggested),
          t.cardStyle,
        )}
      </section>

      {fields && onFieldsChange ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">{t.cardFields}</h3>
          <p className="text-xs text-muted-foreground">{t.cardFieldsHelp}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CARD_FIELDS.map((f) => (
              <label
                key={f}
                className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 text-sm"
              >
                <Checkbox
                  checked={fields.includes(f)}
                  onCheckedChange={(v) => {
                    onFieldsChange(
                      v === true
                        ? CARD_FIELDS.filter(
                            (x) => x === f || fields.includes(x),
                          )
                        : fields.filter((x) => x !== f),
                    );
                  }}
                />
                {t.cardFieldLabels[f]}
              </label>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
