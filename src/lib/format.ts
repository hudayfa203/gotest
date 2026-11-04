/** Date/time and number formatting for the UI (uses the device locale via Intl). */

export function timeAgo(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return formatDate(iso);
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return d.toISOString().replace('T', ' ').slice(0, 16);
  }
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

export function formatDuration(seconds?: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return '';
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const TYPE_LABELS: Record<string, string> = {
  analysis: 'Analysis',
  opinion: 'Opinion',
  investigation: 'Investigation',
  explainer: 'Explainer',
  live: 'Live',
  video: 'Video',
  podcast: 'Podcast',
  sponsored: 'Sponsored',
};
/** Kicker for non-news content types ("Analysis", "Opinion"…); news has none. */
export function typeKicker(type: string): string | null {
  return TYPE_LABELS[type] ?? null;
}

export function authorNames(authors: { name: string }[]) {
  const names = authors.map((a) => a.name);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Compact date-time for timelines: "20:26" today, "3 Nov, 06:25" this year, "3 Nov 2025" otherwise. */
export function shortDateTime(iso: string, now: number = Date.now()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const n = new Date(now);
  if (d.toDateString() === n.toDateString()) return formatTime(iso);
  try {
    if (d.getFullYear() === n.getFullYear()) return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${formatTime(iso)}`;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}
