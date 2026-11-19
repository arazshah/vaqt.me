'use client';

import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';

import { Button } from '@vaqt/ui/components/ui/button';

import { fa } from '@/messages/fa';

export function PhotoPicker({
  avatarUrl,
  initial,
  onUpload,
  onRemove,
}: {
  avatarUrl: string | null;
  initial: string;
  onUpload: (file: File) => Promise<boolean>;
  onRemove: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = fa.editor;

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFailed(false);
    const ok = await onUpload(file);
    setFailed(!ok);
    setBusy(false);
    if (input.current) input.current.value = '';
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted text-2xl font-bold text-muted-foreground"
        aria-label={avatarUrl ? t.photoChange : t.photoAdd}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          initial || <Camera aria-hidden="true" />
        )}
      </button>
      <div className="flex flex-col items-start gap-1.5">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {avatarUrl ? t.photoChange : t.photoAdd}
          </Button>
          {avatarUrl ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void onRemove()}
            >
              {t.photoRemove}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{t.photoHelp}</p>
        {failed ? (
          <p role="alert" className="text-xs text-destructive">
            {t.photoError}
          </p>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}
