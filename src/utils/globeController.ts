import type { LiveEvent } from "../types";

export type BBox = [number, number, number, number];
export type ViewKey = "3d" | "2d";

export interface GlobeApi {
  flyTo: (lat: number, lng: number, relAltitude?: number, bbox?: BBox | null) => void;
  /** Return the view to the default framing for whichever map is showing. */
  reset: () => void;
}

const apis: Record<ViewKey, GlobeApi | null> = { "3d": null, "2d": null };
let activeView: ViewKey = "3d";
const coords = new Map<string, { lat: number; lng: number }>();

function activeApi(): GlobeApi | null {
  return apis[activeView];
}

export function registerGlobe(view: ViewKey, next: GlobeApi | null): void {
  apis[view] = next;
  if (next) activeView = view;
}

/** Reset the camera of the view the user is currently looking at. */
export function resetActiveView(): void {
  activeApi()?.reset();
}

export function syncGlobeEvents(events: LiveEvent[]): void {
  coords.clear();
  for (const e of events) coords.set(e.id, { lat: e.lat, lng: e.lng });
}

export function focusEvent(id: string): void {
  const c = coords.get(id);
  const api = activeApi();
  // 0.5 puts the camera about half a radius above the surface: close enough
  // that coastlines and neighbouring places frame the marker, far enough that
  // the event still reads in context. On the 2D map that maps to zoom 7.
  if (c && api) api.flyTo(c.lat, c.lng, 0.5);
}

export function flyToSearch(
  lat: number,
  lng: number,
  bbox: [number, number, number, number] | null,
): void {
  const api = activeApi();
  if (!api) return;
  if (!bbox) {
    api.flyTo(lat, lng, 0.02);
    return;
  }
  const span = Math.max(bbox[3] - bbox[1], bbox[2] - bbox[0]);
  api.flyTo(lat, lng, Math.min(1.6, Math.max(0.008, span / 45)), bbox);
}

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
