/** Reader preferences stored on the device (AsyncStorage). */
import { kv, KV_KEYS } from '../storage/kv';
import { textScaleSteps } from '../theme';
import { loadServerOverride } from './server';
import { createStore } from './store';

export type Appearance = 'system' | 'light' | 'dark';

export interface Settings {
  appearance: Appearance;
  /** index into textScaleSteps (article text size) */
  textScaleIndex: number;
  /** "Share anonymous usage statistics" */
  analyticsEnabled: boolean;
  loaded: boolean;
}

const DEFAULTS: Settings = { appearance: 'system', textScaleIndex: 1, analyticsEnabled: true, loaded: false };

export const settingsStore = createStore<Settings>(DEFAULTS);

export async function loadSettings() {
  // the server choice (test builds) must be known before the first request goes out
  await loadServerOverride().catch(() => {});
  const saved = await kv.get<Partial<Settings>>(KV_KEYS.settings, {});
  settingsStore.set({ ...DEFAULTS, ...saved, loaded: true });
}

export function updateSettings(patch: Partial<Omit<Settings, 'loaded'>>) {
  settingsStore.set(patch);
  const { loaded: _l, ...persist } = settingsStore.get();
  kv.set(KV_KEYS.settings, persist).catch(() => {});
}

export const useSettings = <S,>(sel: (s: Settings) => S) => settingsStore.use(sel);

export function textScale(index: number) {
  const i = Math.max(0, Math.min(textScaleSteps.length - 1, index));
  return textScaleSteps[i];
}
