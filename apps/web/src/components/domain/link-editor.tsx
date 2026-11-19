'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { LINK_KINDS, type LinkKind } from '@vaqt/shared';

import { LINK_GROUPS, LINK_META } from '@/lib/link-meta';
import type { LinkDrafts } from '@/lib/use-card-draft';
import { fa } from '@/messages/fa';

/**
 * Rows only for the links the user actually has. Each row shows the fixed
 * part of the address (e.g. linkedin.com/in/) so only the personal part is
 * typed; pasting a full URL still works (the shared normaliser strips it).
 */
export function LinkEditor({
  links,
  errors,
  onChange,
  phoneHint,
}: {
  links: LinkDrafts;
  errors: Partial<Record<LinkKind, true>>;
  onChange: (next: LinkDrafts) => void;
  /** 9123456789 — lets WhatsApp offer "same as my number". */
  phoneHint?: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const t = fa.editor;
  const added = LINK_KINDS.filter((k) => k in links);
  const available = LINK_KINDS.filter((k) => !(k in links));

  function setValue(kind: LinkKind, value: string) {
    onChange({ ...links, [kind]: value });
  }
  function remove(kind: LinkKind) {
    onChange(
      Object.fromEntries(Object.entries(links).filter(([k]) => k !== kind)),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {added.length === 0 ? (
        <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
          {t.noLinks}
        </p>
      ) : null}

      {added.map((kind) => {
        const meta = LINK_META[kind];
        const invalid = errors[kind] === true;
        return (
          <div key={kind} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: meta.bg, color: '#fff' }}
                aria-hidden="true"
              >
                {meta.mark}
              </span>
              <label
                dir="ltr"
                className={`flex min-w-0 flex-1 items-center overflow-hidden rounded-xl border bg-background text-sm focus-within:ring-2 focus-within:ring-ring/50 ${
                  invalid ? 'border-destructive' : ''
                }`}
              >
                <span className="shrink-0 select-none bg-muted px-3 py-2.5 text-muted-foreground">
                  {meta.prefix}
                </span>
                <input
                  value={links[kind] ?? ''}
                  onChange={(e) => {
                    setValue(kind, e.target.value);
                  }}
                  placeholder={meta.placeholder}
                  aria-label={fa.cardEditPage.linkLabels[kind]}
                  aria-invalid={invalid}
                  inputMode={kind === 'whatsapp' ? 'tel' : 'text'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={300}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  remove(kind);
                }}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`${t.removeLink} ${fa.cardEditPage.linkLabels[kind]}`}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center justify-between ps-12 text-xs">
              <span
                className={
                  invalid ? 'text-destructive' : 'text-muted-foreground'
                }
              >
                {invalid ? t.invalid : fa.cardEditPage.linkLabels[kind]}
              </span>
              {kind === 'whatsapp' && phoneHint && !links[kind] ? (
                <button
                  type="button"
                  className="text-primary"
                  onClick={() => {
                    setValue(kind, phoneHint);
                  }}
                >
                  {t.usePhoneForWhatsapp}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      {available.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => {
              setAdding((a) => !a);
            }}
            aria-expanded={adding}
            className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t.addLink}
          </button>
          {adding ? (
            <div className="mt-3 flex flex-col gap-3 rounded-2xl border bg-muted/40 p-3">
              {LINK_GROUPS.map((g) => {
                const kinds = available.filter((k) => LINK_META[k].group === g);
                if (kinds.length === 0) return null;
                return (
                  <div key={g}>
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                      {t.groups[g]}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {kinds.map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            onChange({ ...links, [k]: '' });
                            setAdding(false);
                          }}
                          className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary"
                        >
                          <span
                            className="flex size-5 items-center justify-center rounded-md text-[10px] font-bold text-white"
                            style={{
                              backgroundColor: LINK_META[k].bg,
                              color: '#fff',
                            }}
                            aria-hidden="true"
                          >
                            {LINK_META[k].mark}
                          </span>
                          {fa.cardEditPage.linkLabels[k]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
