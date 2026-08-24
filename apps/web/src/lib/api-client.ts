export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface BackendErrorBody {
  code?: string;
  message?: string;
}

// Narrower than RequestInit: headers is restricted to a plain string map.
// RequestInit['headers'] also accepts a Headers instance or a
// [string, string][] tuple array, and spreading either of those into a
// plain object produces garbage (numeric-index keys, not real header
// names) — no call site here ever needs those forms, so the type just
// forbids them instead of handling them correctly.
type SafeRequestInit = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

// Every mutating request also needs an Origin header matching WEB_ORIGIN
// (see origin-check.middleware.ts on the API side) — the browser sets this
// automatically on fetch(), which is exactly why every call here must run
// client-side, never from a Next.js Server Component (see CLAUDE.md bond
// on the origin-check bug found in this PR).
function rawRequest(path: string, init?: SafeRequestInit): Promise<Response> {
  return fetch(`${BASE_URL}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

// Concurrent 401s from multiple in-flight calls must trigger exactly one
// refresh, not one per call — the second rotation would revoke the first
// (refresh token rotation + reuse detection, CLAUDE.md bond 20) and log
// every other tab/call out.
let refreshInFlight: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  refreshInFlight ??= rawRequest('/auth/refresh', { method: 'POST' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export interface ApiFetchOptions {
  /**
   * When the access token is expired AND the refresh attempt itself also
   * fails (refresh token expired/revoked too), redirect the browser to
   * /login instead of surfacing a raw error. Defaults to true. Callers
   * that only want to know "is anyone logged in?" (e.g. the auth context's
   * initial GET /auth/me on every page, including guest-facing ones) must
   * pass false — otherwise every guest visitor would get bounced to
   * /login before they ever see a page.
   */
  redirectOnAuthFailure?: boolean;
}

export async function apiFetch<T>(
  path: string,
  init?: SafeRequestInit,
  options?: ApiFetchOptions,
): Promise<T> {
  const redirectOnAuthFailure = options?.redirectOnAuthFailure ?? true;

  let res = await rawRequest(path, init);

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry exactly once with the (now rotated) cookie. No further
      // refresh/retry loop if this second attempt also 401s — it just
      // falls through to the normal error handling below.
      res = await rawRequest(path, init);
    } else {
      if (redirectOnAuthFailure && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new ApiError(
        'SESSION_EXPIRED',
        'نشست شما منقضی شده یا وارد نشده‌اید',
        401,
      );
    }
  }

  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const errorBody = (body ?? {}) as BackendErrorBody;
    throw new ApiError(
      errorBody.code ?? 'UNKNOWN_ERROR',
      errorBody.message ?? 'خطای غیرمنتظره‌ای رخ داد',
      res.status,
    );
  }

  return body as T;
}
