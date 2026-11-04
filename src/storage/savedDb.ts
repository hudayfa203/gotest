/** Saved articles — full article JSON in SQLite so saved stories open with no network at all. */
import * as SQLite from 'expo-sqlite';
import type { LiveFeedState } from '../lib/live';
import type { Article } from '../types';
import { savedEvents, type SavedItem, type SavedStore } from './savedTypes';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const d = await SQLite.openDatabaseAsync('goworld.db');
      await d.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS saved_articles (
          id TEXT PRIMARY KEY NOT NULL,
          revision INTEGER NOT NULL,
          saved_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          headline TEXT NOT NULL,
          article_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS saved_articles_saved_at ON saved_articles (saved_at DESC);
        CREATE TABLE IF NOT EXISTS saved_live_feeds (
          article_id TEXT PRIMARY KEY NOT NULL,
          server_time TEXT NOT NULL,
          feed_json TEXT NOT NULL
        );
      `);
      return d;
    })();
  }
  return dbPromise;
}

type Row = { id: string; revision: number; saved_at: string; article_json: string; feed_json: string | null };
const parseFeed = (json: string | null): LiveFeedState | null => {
  if (!json) return null;
  try {
    return JSON.parse(json) as LiveFeedState;
  } catch {
    return null;
  }
};
const toItem = (r: Row): SavedItem => ({ id: r.id, revision: r.revision, savedAt: r.saved_at, article: JSON.parse(r.article_json) as Article, live: parseFeed(r.feed_json) });
const SELECT = 'SELECT a.id, a.revision, a.saved_at, a.article_json, l.feed_json FROM saved_articles a LEFT JOIN saved_live_feeds l ON l.article_id = a.id';

export const savedStore: SavedStore = {
  async init() {
    await db();
  },
  async list() {
    const rows = await (await db()).getAllAsync<Row>(`${SELECT} ORDER BY a.saved_at DESC`);
    return rows.map(toItem);
  },
  async get(id) {
    const r = await (await db()).getFirstAsync<Row>(`${SELECT} WHERE a.id = ?`, id);
    return r ? toItem(r) : null;
  },
  async put(article: Article, savedAt?: string) {
    const d = await db();
    const existing = await d.getFirstAsync<{ saved_at: string }>('SELECT saved_at FROM saved_articles WHERE id = ?', article.id);
    await d.runAsync(
      'INSERT OR REPLACE INTO saved_articles (id, revision, saved_at, updated_at, headline, article_json) VALUES (?, ?, ?, ?, ?, ?)',
      article.id, article.revision, savedAt ?? existing?.saved_at ?? new Date().toISOString(), article.updatedAt, article.headline, JSON.stringify(article),
    );
    savedEvents.emit();
  },
  async update(article: Article) {
    const r = await (await db()).runAsync(
      'UPDATE saved_articles SET revision = ?, updated_at = ?, headline = ?, article_json = ? WHERE id = ?',
      article.revision, article.updatedAt, article.headline, JSON.stringify(article), article.id,
    );
    if (r.changes > 0) savedEvents.emit();
    return r.changes > 0;
  },
  async remove(id: string) {
    const d = await db();
    const r = await d.runAsync('DELETE FROM saved_articles WHERE id = ?', id);
    await d.runAsync('DELETE FROM saved_live_feeds WHERE article_id = ?', id);
    if (r.changes > 0) savedEvents.emit();
    return r.changes > 0;
  },
  async putLive(id: string, feed: LiveFeedState) {
    // only for saved articles; the snapshot never needs the "unseen" bookkeeping
    const r = await (await db()).runAsync(
      'INSERT OR REPLACE INTO saved_live_feeds (article_id, server_time, feed_json) SELECT id, ?, ? FROM saved_articles WHERE id = ?',
      feed.serverTime, JSON.stringify({ ...feed, unseenIds: [] }), id,
    );
    if (r.changes > 0) savedEvents.emit();
    return r.changes > 0;
  },
  async revisions() {
    return (await db()).getAllAsync<{ id: string; revision: number }>('SELECT id, revision FROM saved_articles');
  },
  async clear() {
    const d = await db();
    await d.runAsync('DELETE FROM saved_articles');
    await d.runAsync('DELETE FROM saved_live_feeds');
    savedEvents.emit();
  },
};
