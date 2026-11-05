import { MAP_H, MAP_W, PROJ } from './mapData';

const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

/** Equal Earth projection (Šavrič, Patterson & Jenny 2018) with the website's fitted scale/offset → map pixels. */
export function project(lng: number, lat: number): { x: number; y: number } | null {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const lambda = (lng * Math.PI) / 180;
  const l = Math.asin(M * Math.sin((lat * Math.PI) / 180));
  const l2 = l * l;
  const l6 = l2 * l2 * l2;
  const x = (lambda * Math.cos(l)) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)));
  const y = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2));
  const px = x * PROJ.k + PROJ.tx;
  const py = PROJ.ty - y * PROJ.k;
  if (px < 0 || px > MAP_W || py < 0 || py > MAP_H) return null;
  return { x: px, y: py };
}

export interface Placed<T> {
  x: number;
  y: number;
  items: T[];
}

/** Markers closer than `radius` map pixels share one cluster (count badge), as on the website. */
export function cluster<T>(points: { x: number; y: number; item: T }[], radius: number): Placed<T>[] {
  const out: Placed<T>[] = [];
  for (const p of points) {
    const hit = out.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < radius);
    if (hit) {
      hit.items.push(p.item);
      const n = hit.items.length;
      hit.x += (p.x - hit.x) / n;
      hit.y += (p.y - hit.y) / n;
    } else out.push({ x: p.x, y: p.y, items: [p.item] });
  }
  return out;
}
