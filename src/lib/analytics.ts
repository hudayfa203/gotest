/**
 * First-party reading analytics → POST /events (batched).
 * - random session id per app session (not tied to the device or account)
 * - honours Settings → "Share anonymous usage statistics"
 * - never sends from the web preview
 */
import { AppState, type AppStateStatus } from 'react-native';
import { endpoints } from '../api';
import { IS_WEB_PREVIEW, PLATFORM } from '../config';
import { settingsStore } from '../state/settings';
import type { AnalyticsEvent, AnalyticsEventName } from '../types';

const MAX_BATCH = 20;
const FLUSH_MS = 15_000;

function randomId() {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i++) s += hex[Math.floor(Math.random() * 16)];
  return `app-${s}`;
}

export const sessionId = randomId();
let queue: AnalyticsEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function enabled() {
  return !IS_WEB_PREVIEW && settingsStore.get().analyticsEnabled;
}

export function track(event: AnalyticsEventName, data: { articleId?: string; path?: string; props?: Record<string, string | number | boolean> } = {}) {
  if (!enabled()) return;
  queue.push({ event, platform: PLATFORM, sessionId, ...data });
  if (queue.length >= MAX_BATCH) void flush();
  else if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS);
}

export async function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (flushing || queue.length === 0) return;
  if (!enabled()) {
    queue = [];
    return;
  }
  flushing = true;
  const batch = queue.slice(0, 50);
  queue = queue.slice(batch.length);
  try {
    await endpoints.events(batch);
  } catch {
    // offline: keep a bounded backlog and retry later
    queue = [...batch, ...queue].slice(-200);
  } finally {
    flushing = false;
  }
}

/** Drop anything not yet sent (used when the reader opts out). */
export function clearQueue() {
  queue = [];
}

let started = false;
export function startAnalytics() {
  if (started) return;
  started = true;
  AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'background' || s === 'inactive') void flush();
  });
  settingsStore.subscribe(() => {
    if (!settingsStore.get().analyticsEnabled) clearQueue();
  });
}
