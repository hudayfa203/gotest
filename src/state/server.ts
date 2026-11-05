/**
 * Test builds only: which Garowe World server the app talks to (Settings → Server).
 *
 * The test APK published on GitHub is built with ALLOW_SERVER_OVERRIDE so a tester can point an installed app at a
 * staging or self-hosted backend without waiting for a new build. Store builds ignore all of this.
 */
import { ALLOW_SERVER_OVERRIDE, BUILD_API_URL, DEMO_CONTENT, getApiUrl, hasApiOverride, isDemoMode, setApiOverride, setDemoMode } from '../config';
import { kv } from '../storage/kv';
import { createStore } from './store';

const KEY = 'gw.server.override.v1'; // 'demo' | 'server' | an API URL

export type ServerCheck = { ok: true; name?: string; ms: number } | { ok: false; message: string };

export interface ServerState {
  apiUrl: string;
  /** a tester-entered server instead of the build-time one */
  overridden: boolean;
  /** the built-in demo stories are shown instead of any server */
  demo: boolean;
}
export const serverStore = createStore<ServerState>({ apiUrl: BUILD_API_URL, overridden: false, demo: false });
export const useServer = <S,>(sel: (s: ServerState) => S) => serverStore.use(sel);
/** Settings shows the "Content source" section in test builds (server override and/or demo stories available). */
export const CONTENT_SOURCE_SETTINGS = ALLOW_SERVER_OVERRIDE || DEMO_CONTENT !== 'off';

const DEMO_CHOICE = 'demo';
const SERVER_CHOICE = 'server';
const publish = () => serverStore.set({ apiUrl: getApiUrl(), overridden: hasApiOverride(), demo: isDemoMode() });

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

/** GET {api}/config — every Garowe World server answers it without credentials. */
export async function checkServer(apiUrl: string, timeoutMs = 10_000): Promise<ServerCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${apiUrl}/config`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) return { ok: false, message: `The server answered HTTP ${res.status}. Is this a Garowe World API address?` };
    const body = (await res.json().catch(() => null)) as { siteName?: unknown; tagline?: unknown } | null;
    if (!body || typeof body !== 'object' || !('tagline' in body || 'siteName' in body)) {
      return { ok: false, message: 'The server answered, but not like a Garowe World API.' };
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
  if (!CONTENT_SOURCE_SETTINGS) return;
  const saved = await kv.getString(KEY).catch(() => null);
  if (saved === DEMO_CHOICE || (!saved && DEMO_CONTENT === 'default')) {
    setDemoMode(true);
    setApiOverride(null);
  } else {
    setDemoMode(false);
    const n = saved && saved !== SERVER_CHOICE && ALLOW_SERVER_OVERRIDE ? normalizeApiUrl(saved) : null;
    setApiOverride(n?.ok ? n.url : null);
  }
  publish();
}

/**
 * Switch the content source: 'demo' = built-in demo stories, null = the server this build was made for, or an API
 * URL. Content cached from the previous source, the device credential and any reader session belong to it, so they
 * are dropped; saved articles stay on the phone.
 */
export async function applyServerOverride(
  choice: string | null,
  deps: { clearCaches: () => Promise<void>; resetCredentials: () => Promise<void> },
) {
  if (!CONTENT_SOURCE_SETTINGS) return;
  if (choice === DEMO_CHOICE) {
    if (DEMO_CONTENT === 'off') return;
    await kv.setString(KEY, DEMO_CHOICE);
    setDemoMode(true);
    setApiOverride(null);
  } else {
    const url = choice && ALLOW_SERVER_OVERRIDE && choice !== BUILD_API_URL ? choice : null;
    await kv.setString(KEY, url ?? SERVER_CHOICE);
    setDemoMode(false);
    setApiOverride(url);
  }
  publish();
  await deps.resetCredentials();
  await deps.clearCaches();
}
