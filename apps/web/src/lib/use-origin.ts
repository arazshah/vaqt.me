'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * The origin the visitor is actually on (https://vaqt.me in production).
 * Client components must not read process.env.WEB_ORIGIN: Next only inlines
 * NEXT_PUBLIC_* into browser code, so it silently fell back to localhost.
 * The server snapshot is empty and the first client render hydrates with it,
 * then switches to window.location.origin.
 */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => '',
  );
}
