/**
 * WEB PREVIEW ONLY: the native app stores saved articles in SQLite (savedDb.ts).
 * The browser preview keeps the same data in localStorage so the Saved tab can be demonstrated.
 */
import type { Article } from '../types';
import { savedEvents, type SavedItem, type SavedStore } from './savedTypes';

const KEY = 'gw.saved.v1';
const read = (): Record<string, SavedItem> => {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};
const write = (m: Record<string, SavedItem>) => {
  window.localStorage.setItem(KEY, JSON.stringify(m));
  savedEvents.emit();
};

export const savedStore: SavedStore = {
  async init() {},
  async list() {
    return Object.values(read()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  },
  async get(id) {
    return read()[id] ?? null;
  },
  async put(article: Article, savedAt?: string) {
    const m = read();
    m[article.id] = { id: article.id, revision: article.revision, savedAt: savedAt ?? m[article.id]?.savedAt ?? new Date().toISOString(), article, live: m[article.id]?.live ?? null };
    write(m);
  },
  async update(article: Article) {
    const m = read();
    if (!m[article.id]) return false;
    m[article.id] = { ...m[article.id], revision: article.revision, article };
    write(m);
    return true;
  },
  async putLive(id, feed) {
    const m = read();
    if (!m[id]) return false;
    m[id] = { ...m[id], live: { ...feed, unseenIds: [] } };
    write(m);
    return true;
  },
  async remove(id) {
    const m = read();
    if (!m[id]) return false;
    delete m[id];
    write(m);
    return true;
  },
  async revisions() {
    return Object.values(read()).map((s) => ({ id: s.id, revision: s.revision }));
  },
  async clear() {
    write({});
  },
};
