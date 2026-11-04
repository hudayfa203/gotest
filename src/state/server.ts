/**
 * Test builds only: which GO World News server the app talks to (Settings → Server).
 *
 * The test APK published on GitHub is built with ALLOW_SERVER_OVERRIDE so a tester can point an installed app at a
 * staging or self-hosted backend without waiting for a new build. Store builds ignore all of this.
 */
import { ALLOW_SERVER_OVERRIDE, BUILD_API_URL, getApiUrl, hasApiOverride, setApiOverride } from '../config';
import { kv } from '../storage/kv';
import { createStore } from './store';

const KEY = 'gw.server.override.v1';

export type ServerCheck = { ok: true; name?: string; ms: number } | { ok: false; message: string };

export const serverStore = createStore<{ apiUrl: string; overridden: boolean }>({ apiUrl: BUILD_API_URL, overridden: false });
export const useServer = <S,>(sel: (s: { apiUrl: string; overridden: boolean }) => S) => serverStore.use(sel);

/**
 * Accepts what a tester is likely to type and returns the API base:
 *   staging.example.com            → https://staging.example.com/api/v1
 *   https://staging.example.com/   → https://staging.example.com/api/v1
 *   https://x.example.com/api/v1   → unchanged
 * Only https is accepted: Android release builds block cleartext http, so an http server could never work.
 */
export function normalizeApiUrl(input: string): { ok: true; url: string } | { ok: false; message: string } {
  let raw = input.trim();
  if (!raw) return { ok: false, message: 'Enter the server address.' };
  if (!/^[a-z]+:\/\//i.test(raw)) raw = `https://${raw}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, message: 'That is not a valid web address.' };
  }
  if (u.protocol !== 'https:') return { ok: false, message: 'The server must use https:// (Android blocks plain http in release builds).' };
  if (!u.hostname || !u.hostname.includes('.')) return { ok: false, message: 'Enter a full host name, e.g. staging.example.com.' };
  if (u.search || u.hash) return { ok: false, message: 'Leave out ? and # parts of the address.' };
  let path = u.pathname.replace(/\/+$/, '');
  if (!/\/api\/v\d+$/.test(path)) path = `${path}/api/v1`;
  return { ok: true, url: `${u.protocol}//${u.host}${path}` };
}

/** GET {api}/config — every GO World News server answers it without credentials. */
export async function checkServer(apiUrl: string, timeoutMs = 10_000): Promise<ServerCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${apiUrl}/config`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) return { ok: false, message: `The server answered HTTP ${res.status}. Is this a GO World News API address?` };
    const body = (await res.json().catch(() => null)) as { siteName?: unknown; tagline?: unknown } | null;
    if (!body || typeof body !== 'object' || !('tagline' in body || 'siteName' in body)) {
      return { ok: false, message: 'The server answered, but not like a GO World News API.' };
    }
    return { ok: true, name: typeof body.siteName === 'string' ? body.siteName : undefined, ms: Date.now() - started };
  } catch {
    return { ok: false, message: controller.signal.aborted ? 'No answer within 10 seconds.' : 'Could not connect (check the address and your internet connection).' };
  } finally {
    clearTimeout(timer);
  }
}

/** Called once at start-up, before the first request (the root layout waits for settings, which waits for this). */
export async function loadServerOverride() {
  if (!ALLOW_SERVER_OVERRIDE) return;
  const saved = await kv.getString(KEY).catch(() => null);
  const n = saved ? normalizeApiUrl(saved) : null;
  setApiOverride(n?.ok ? n.url : null);
  serverStore.set({ apiUrl: getApiUrl(), overridden: hasApiOverride() });
}

/**
 * Switch servers (null = back to the build default). Content cached from the previous server, the device credential
 * and any reader session belong to that server, so they are dropped; saved articles stay on the phone.
 */
export async function applyServerOverride(apiUrl: string | null, deps: { clearCaches: () => Promise<void>; resetCredentials: () => Promise<void> }) {
  if (!ALLOW_SERVER_OVERRIDE) return;
  const next = apiUrl && apiUrl !== BUILD_API_URL ? apiUrl : null;
  if (next) await kv.setString(KEY, next);
  else await kv.remove(KEY);
  setApiOverride(next);
  serverStore.set({ apiUrl: getApiUrl(), overridden: hasApiOverride() });
  await deps.resetCredentials();
  await deps.clearCaches();
}
