/**
 * Minimal, dependency-free API client for GO World News API v1 (docs/API.md).
 * Pure module: everything platform-specific (fetch, tokens) is injected, so it is unit-tested.
 */
import type { Tombstone } from '../types';

export type AuthMode = 'none' | 'device' | 'reader' | 'device+reader';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  auth?: AuthMode;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ApiClientDeps {
  /** API base, or a function returning it (read on every request, so a server change applies immediately) */
  baseUrl: string | (() => string);
  fetch?: typeof fetch;
  getDeviceToken?: () => Promise<string | null>;
  getSessionToken?: () => Promise<string | null>;
  /** called when a device-authenticated call is refused with 401 — the app re-registers once */
  onDeviceUnauthorized?: () => Promise<string | null>;
  defaultTimeoutMs?: number;
}

/** Server answered with an error envelope `{ error: { code, message, requestId } }`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

/** 410 Gone for a withdrawn article — apps must delete any offline copy. */
export class GoneError extends ApiError {
  readonly tombstone: Tombstone | null;
  constructor(message: string, tombstone: Tombstone | null, requestId?: string) {
    super(410, 'GONE', message, requestId);
    this.name = 'GoneError';
    this.tombstone = tombstone;
  }
}

/** No response at all (offline, DNS, TLS, CORS in the web preview, timeout). */
export class NetworkError extends Error {
  readonly cause?: unknown;
  readonly timedOut: boolean;
  constructor(message: string, cause?: unknown, timedOut = false) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
    this.timedOut = timedOut;
  }
}

export function isNetworkError(e: unknown): e is NetworkError {
  return e instanceof NetworkError || (e instanceof Error && e.name === 'NetworkError');
}
export function isGone(e: unknown): e is GoneError {
  return e instanceof GoneError || (e instanceof Error && e.name === 'GoneError');
}
export function isNotFound(e: unknown) {
  return e instanceof ApiError && e.status === 404;
}

/** Human-readable message for UI error states (never shows raw stack traces). */
export function describeError(e: unknown): string {
  if (isNetworkError(e)) return e.timedOut ? 'The server took too long to respond.' : 'You appear to be offline, or the server could not be reached.';
  if (e instanceof ApiError) {
    if (e.status === 404) return 'This content could not be found.';
    if (e.status === 410) return e.message || 'This content has been withdrawn.';
    if (e.status === 429) return 'Too many requests — please wait a moment and try again.';
    if (e.status === 401) return 'Please sign in again.';
    if (e.status >= 500) return 'The news service is having a problem. Please try again shortly.';
    return e.message || 'Something went wrong.';
  }
  return 'Something went wrong.';
}

export function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']) {
  const base = baseUrl.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return `${base}${p}${qs ? `?${qs}` : ''}`;
}

export function createApiClient(deps: ApiClientDeps) {
  const doFetch = deps.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const defaultTimeout = deps.defaultTimeoutMs ?? 15_000;

  async function headersFor(auth: AuthMode, hasBody: boolean, deviceTokenOverride?: string | null) {
    // Only CORS-safelisted headers on anonymous GETs (keeps CDN caching + web preview simple).
    const h: Record<string, string> = { Accept: 'application/json' };
    if (hasBody) h['Content-Type'] = 'application/json';
    if (auth === 'device' || auth === 'device+reader') {
      const t = deviceTokenOverride !== undefined ? deviceTokenOverride : await deps.getDeviceToken?.();
      if (t) h['X-Device-Token'] = t;
    }
    if (auth === 'reader' || auth === 'device+reader') {
      const s = await deps.getSessionToken?.();
      if (s) h.Authorization = `Bearer ${s}`;
    }
    return h;
  }

  async function send(path: string, opts: RequestOptions, deviceTokenOverride?: string | null): Promise<Response> {
    const { method = 'GET', query, body, auth = 'none', signal, timeoutMs = defaultTimeout } = opts;
    const url = buildUrl(typeof deps.baseUrl === 'function' ? deps.baseUrl() : deps.baseUrl, path, query);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener?.('abort', onAbort);
    try {
      return await doFetch(url, {
        method,
        headers: await headersFor(auth, body !== undefined, deviceTokenOverride),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      if (signal?.aborted) throw e; // caller cancelled (e.g. React Query) — propagate the AbortError
      throw new NetworkError(timedOut ? 'Request timed out' : 'Network request failed', e, timedOut);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
    }
  }

  async function parse<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: any = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = undefined;
      }
    }
    if (res.ok) {
      // a 2xx that is not JSON is not our API: a captive Wi-Fi login page, a parked domain, a wrong server address
      if (text && data === undefined) {
        throw new ApiError(res.status, 'INVALID_RESPONSE', 'The server sent an answer that is not GO World News data. On public Wi-Fi, open your browser and sign in to the network first.');
      }
      return data as T;
    }
    const err = data?.error ?? {};
    if (res.status === 410) throw new GoneError(err.message || data?.tombstone?.notice || 'This content has been withdrawn', data?.tombstone ?? null, err.requestId || undefined);
    throw new ApiError(res.status, err.code || `HTTP_${res.status}`, err.message || res.statusText || `HTTP ${res.status}`, err.requestId || undefined);
  }

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    let res = await send(path, opts);
    const usesDevice = opts.auth === 'device' || opts.auth === 'device+reader';
    if (res.status === 401 && usesDevice && deps.onDeviceUnauthorized) {
      // device credential unknown to the server (e.g. database reset) → register again, retry once
      const fresh = await deps.onDeviceUnauthorized();
      if (fresh) res = await send(path, opts, fresh);
    }
    return parse<T>(res);
  }

  return {
    request,
    get baseUrl() {
      return typeof deps.baseUrl === 'function' ? deps.baseUrl() : deps.baseUrl;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
