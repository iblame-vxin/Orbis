import type { LiveEvent } from "../types";

export function eventMatchesCountry(
  ev: LiveEvent,
  polys: Array<Array<[number, number]>> | null,
  bbox: [number, number, number, number] | null,
): boolean {
  if (!polys || polys.length === 0) return true;
  const [minLng, minLat, maxLng, maxLat] = bbox as [number, number, number, number];
  if (ev.lng < minLng || ev.lng > maxLng || ev.lat < minLat || ev.lat > maxLat) return false;
  for (const ring of polys) {
    if (pointInRing(ev.lng, ev.lat, ring)) return true;
  }
  return false;
}

function pointInRing(x: number, y: number, ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function centroidOf(rings: Array<Array<[number, number]>>): [number, number] {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      sx += x;
      sy += y;
      n += 1;
    }
  }
  if (n === 0) return [0, 0];
  return [sy / n, sx / n];
}

export function geometryCentroid(geometry: unknown): [number, number] | null {
  if (!geometry || typeof geometry !== "object") return null;
  const g = geometry as { type: string; coordinates: unknown };
  try {
    if (g.type === "Point") {
      const c = g.coordinates as [number, number];
      return [c[1], c[0]];
    }
    if (g.type === "MultiPoint") {
      const pts = g.coordinates as Array<[number, number]>;
      if (!pts.length) return null;
      let sx = 0;
      let sy = 0;
      for (const p of pts) {
        sx += p[0];
        sy += p[1];
      }
      return [sy / pts.length, sx / pts.length];
    }
    if (g.type === "Polygon") {
      const rings = (g.coordinates as Array<Array<[number, number]>>).map((r) => r);
      return centroidOf(rings);
    }
    if (g.type === "MultiPolygon") {
      const polys = g.coordinates as Array<Array<Array<[number, number]>>>;
      const flat = polys.flat(1);
      return centroidOf(flat);
    }
    if (g.type === "LineString") {
      const pts = g.coordinates as Array<[number, number]>;
      if (!pts.length) return null;
      let sx = 0;
      let sy = 0;
      for (const p of pts) {
        sx += p[0];
        sy += p[1];
      }
      return [sy / pts.length, sx / pts.length];
    }
  } catch {
    return null;
  }
  return null;
}
