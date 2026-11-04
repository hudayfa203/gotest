import type { LiveFeedState } from '../lib/live';
import type { Article } from '../types';

export interface SavedItem {
  id: string;
  revision: number;
  savedAt: string;
  article: Article;
  /** live coverage: the updates as last fetched (GET /live/{id}), so a saved copy shows them offline */
  live?: LiveFeedState | null;
}

/** Same interface for the native SQLite store and the web-preview localStorage store. */
export interface SavedStore {
  init(): Promise<void>;
  list(): Promise<SavedItem[]>;
  get(id: string): Promise<SavedItem | null>;
  /** insert or replace the full article (body included) — readable fully offline */
  put(article: Article, savedAt?: string): Promise<void>;
  /** refresh an existing offline copy (no-op when the article is not saved) */
  update(article: Article): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  /** store the last fetched live feed of a SAVED article (no-op when the article is not saved) */
  putLive(id: string, feed: LiveFeedState): Promise<boolean>;
  revisions(): Promise<{ id: string; revision: number }[]>;
  clear(): Promise<void>;
}

type Listener = () => void;
const listeners = new Set<Listener>();
export const savedEvents = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  emit() {
    listeners.forEach((l) => l());
  },
};
