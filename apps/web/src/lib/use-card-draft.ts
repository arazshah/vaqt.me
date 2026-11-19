'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LINK_KINDS,
  normalizeLinkValue,
  type CardCategory,
  type CardTemplate,
  type LinkKind,
  type MyCard,
} from '@vaqt/shared';

import { ApiError, apiFetch } from '@/lib/api-client';
import { squareJpeg } from '@/lib/image';
import { fa } from '@/messages/fa';

/** What the user typed per link, WITHOUT the fixed prefix. A key's presence
 *  means the row is shown, even while its value is still empty. */
export type LinkDrafts = Partial<Record<LinkKind, string>>;
export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

function post<T>(path: string, body: unknown = {}): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

/** Typed text → the raw value sent to the API (which normalises it). */
export function toRawLink(kind: LinkKind, typed: string): string {
  const v = typed.trim();
  if (kind === 'whatsapp') {
    const digits = v.replace(/\D/g, '');
    const national = digits.startsWith('98') ? digits.slice(2) : digits;
    return `+98${national.replace(/^0+/, '')}`;
  }
  return v;
}

/** Stored canonical value → what we show after the fixed prefix. */
export function fromStoredLink(kind: LinkKind, value: string): string {
  if (kind === 'whatsapp') return value.replace(/^\+98/, '');
  if (kind === 'website')
    return value.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return value;
}

export function linkIsValid(kind: LinkKind, typed: string): boolean {
  return normalizeLinkValue(kind, toRawLink(kind, typed)) !== null;
}

export interface CardDraft {
  username: string | null;
  displayName: string;
  headline: string;
  bio: string;
  city: string;
  category: CardCategory | null;
  template: CardTemplate;
  showPhone: boolean;
  links: LinkDrafts;
  avatarUrl: string | null;
}

const EMPTY: CardDraft = {
  username: null,
  displayName: '',
  headline: '',
  bio: '',
  city: '',
  category: null,
  template: 'tile',
  showPhone: false,
  links: {},
  avatarUrl: null,
};

function fromCard(card: MyCard): CardDraft {
  return {
    username: card.username,
    displayName: card.displayName,
    headline: card.headline ?? '',
    bio: card.bio ?? '',
    city: card.city ?? '',
    category: card.category,
    template: card.template,
    showPhone: card.showPhone,
    links: Object.fromEntries(
      card.links.map((l) => [l.kind, fromStoredLink(l.kind, l.value)]),
    ),
    avatarUrl: card.avatarUrl,
  };
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Loads the owner's card into an editable draft and (optionally) saves it
 * automatically a moment after the last change.
 */
export function useCardDraft(enabled: boolean, autosave: boolean) {
  const [draft, setDraft] = useState<CardDraft>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const lastSaved = useRef<string>('');

  useEffect(() => {
    if (!enabled) return;
    post<MyCard>('/cards/me')
      .then((card) => {
        const d = fromCard(card);
        lastSaved.current = serialise(d);
        setDraft(d);
        setLoaded(true);
      })
      .catch(() => {
        setLoadFailed(true);
      });
  }, [enabled]);

  const patch = useCallback((p: Partial<CardDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  const linkErrors: Partial<Record<LinkKind, true>> = {};
  for (const kind of LINK_KINDS) {
    const typed = draft.links[kind];
    if (typed?.trim() && !linkIsValid(kind, typed)) linkErrors[kind] = true;
  }
  const hasLinkErrors = Object.keys(linkErrors).length > 0;

  const save = useCallback(async (): Promise<boolean> => {
    if (hasLinkErrors) {
      setSaveState('error');
      setMessage(fa.editor.invalid);
      return false;
    }
    setSaveState('saving');
    try {
      await post('/users/me/update', {
        displayName: draft.displayName,
        headline: draft.headline.trim() || null,
        bio: draft.bio.trim() || null,
        city: draft.city.trim() || null,
      });
      const links: { kind: LinkKind; value: string }[] = [];
      for (const kind of LINK_KINDS) {
        const typed = draft.links[kind];
        if (typed?.trim()) links.push({ kind, value: toRawLink(kind, typed) });
      }
      await post('/cards/me/update', {
        template: draft.template,
        category: draft.category,
        showPhone: draft.showPhone,
        links,
      });
      lastSaved.current = serialise(draft);
      setSaveState('saved');
      setMessage(null);
      return true;
    } catch (err) {
      setSaveState('error');
      setMessage(errorText(err, fa.editor.autosave.error));
      return false;
    }
  }, [draft, hasLinkErrors]);

  // Debounced autosave. The username and avatar have their own actions.
  useEffect(() => {
    if (!autosave || !loaded) return;
    if (serialise(draft) === lastSaved.current) return;
    setSaveState('dirty');
    const id = setTimeout(() => {
      void save();
    }, 1100);
    return () => {
      clearTimeout(id);
    };
  }, [autosave, loaded, draft, save]);

  async function saveUsername(username: string): Promise<string | null> {
    try {
      const card = await post<MyCard>('/cards/me/username', { username });
      patch({ username: card.username });
      return null;
    } catch (err) {
      return errorText(err, fa.editor.autosave.error);
    }
  }

  async function uploadAvatar(file: File): Promise<boolean> {
    try {
      const blob = await squareJpeg(file);
      const form = new FormData();
      form.append('file', blob, 'avatar.jpg');
      await apiFetch('/users/me/avatar', { method: 'POST', body: form });
      const card = await post<MyCard>('/cards/me');
      patch({ avatarUrl: card.avatarUrl });
      return true;
    } catch {
      return false;
    }
  }

  async function removeAvatar(): Promise<void> {
    try {
      await post('/users/me/avatar/delete');
      patch({ avatarUrl: null });
    } catch {
      // keep the current photo if deletion failed
    }
  }

  return {
    draft,
    patch,
    loaded,
    loadFailed,
    saveState,
    message,
    save,
    saveUsername,
    uploadAvatar,
    removeAvatar,
    linkErrors,
  };
}

function serialise(d: CardDraft): string {
  const { username: _u, avatarUrl: _a, ...rest } = d;
  return JSON.stringify(rest);
}
