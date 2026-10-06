import { useCallback, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import type { EventType, LiveEvent } from "../types";
import { geometryCentroid } from "../utils/geo";

const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson";
const EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open";
const GDACS_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH";

const QUAKE_MS = 60 * 1000;
const EONET_MS = 120 * 1000;

/**
 * How long a successful response is reused before the network is hit again.
 * Applies to the polling loop and to the Refresh button, so mashing Refresh
 * cannot hammer the upstream APIs. Failed responses are never cached.
 */
const CACHE_TTL_MS = 3 * 60 * 1000;

interface CacheEntry {
  /** Wall-clock time of the real network response. */
  at: number;
  json: unknown;
}

const responseCache = new Map<string, CacheEntry>();

interface FetchResult {
  json: unknown;
  /** Timestamp of the real response (unchanged when served from cache). */
  at: number;
  fromCache: boolean;
}

/**
 * fetch() + a small in-memory TTL cache.
 * Keyed by URL, which is fine here because every feed URL is static.
 */
async function fetchJson(url: string, signal?: AbortSignal): Promise<FetchResult> {
  const hit = responseCache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { json: hit.json, at: hit.at, fromCache: true };
  }
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`${url} responded ${r.status}`);
  const json: unknown = await r.json();
  const entry: CacheEntry = { at: Date.now(), json };
  responseCache.set(url, entry);
  return { json, at: entry.at, fromCache: false };
}

interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    url: string | null;
    title?: string;
  };
  geometry: { coordinates: [number, number, number?] } | null;
}

interface EonetGeometry {
  date?: string;
  type?: string;
  coordinates?: unknown;
}

interface EonetEvent {
  id?: string;
  title?: string;
  categories?: Array<{ id?: string; title?: string }>;
  sources?: Array<{ url?: string }>;
  link?: string;
  geometry?: EonetGeometry[];
}

function eonetType(cats: Array<{ id?: string; title?: string }> | undefined): EventType | null {
  const ids = (cats || []).map((c) => (c.id || c.title || "").toLowerCase());
  if (ids.some((s) => s.includes("wildfire"))) return "fire";
  if (ids.some((s) => s.includes("flood"))) return "flood";
  if (ids.some((s) => s.includes("storm") || s.includes("cyclone") || s.includes("hurricane") || s.includes("typhoon"))) return "storm";
  return null;
}

function parseQuakes(json: { features: UsgsFeature[] }): LiveEvent[] {
  const out: LiveEvent[] = [];
  for (const f of json.features || []) {
    if (!f.geometry || !Array.isArray(f.geometry.coordinates)) continue;
    const [lng, lat] = f.geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      id: `quake:${f.id}`,
      type: "quake",
      title: f.properties.title || `M${f.properties.mag ?? "?"} earthquake`,
      place: f.properties.place || "Unknown location",
      lat,
      lng,
      time: f.properties.time,
      magnitude: typeof f.properties.mag === "number" ? f.properties.mag : null,
      severity: null,
      source: "USGS",
      url: f.properties.url,
    });
  }
  return out;
}

function centerOfEonetGeometry(geoms: EonetGeometry[] | undefined): { lat: number; lng: number; time: number } | null {
  if (!Array.isArray(geoms) || geoms.length === 0) return null;
  const dated = geoms
    .map((g) => ({ g, t: g.date ? Date.parse(g.date) : NaN }))
    .filter((d) => Number.isFinite(d.t))
    .sort((a, b) => b.t - a.t);
  const pool = dated.length ? dated : geoms.map((g) => ({ g, t: Date.now() }));
  for (const { g, t } of pool) {
    if (!g.type || g.coordinates === undefined) continue;
    if (g.type === "Point" && Array.isArray(g.coordinates)) {
      const [lng, lat] = g.coordinates as [number, number];
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, time: t };
    } else {
      const center = geometryCentroid({ type: g.type, coordinates: g.coordinates });
      if (center) return { lat: center[0], lng: center[1], time: t };
    }
  }
  return null;
}

function parseEonet(json: { events?: EonetEvent[]; features?: never }): LiveEvent[] {
  const out: LiveEvent[] = [];
  for (const f of json.events || []) {
    const type = eonetType(f.categories);
    if (!type) continue;
    const center = centerOfEonetGeometry(f.geometry);
    if (!center) continue;
    const id = f.id || `${type}-${center.lat}-${center.lng}-${center.time}`;
    const src = (f.sources && f.sources[0] && f.sources[0].url) || f.link || null;
    out.push({
      id: `${type}:${id}`,
      type,
      title: f.title || "Unnamed event",
      place: f.title || "Unknown location",
      lat: center.lat,
      lng: center.lng,
      time: center.time,
      magnitude: null,
      severity: null,
      source: "EONET",
      url: src,
    });
  }
  return out;
}

interface GdacsItem {
  eventid?: number;
  eventtype?: string;
  name?: string;
  htmldescription?: string;
  latitude?: number;
  longitude?: number;
  fromdate?: string;
  alertlevel?: string;
  url?: { report?: string };
}

/** GDACS publishes a three-step alert level; map it onto the 0-1 severity scale. */
const GDACS_SEVERITY: Record<string, number> = { GREEN: 0.33, ORANGE: 0.66, RED: 1 };

function gdacsTime(p: GdacsItem): number {
  if (p.fromdate) {
    const t = Date.parse(p.fromdate);
    if (Number.isFinite(t)) return t;
  }
  const m = p.htmldescription && p.htmldescription.match(/(\d{1,2} \w{3} \d{4})/);
  if (m) {
    const t = Date.parse(m[1]);
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

function parseGdacs(json: unknown): LiveEvent[] {
  const arr = (json as { features?: Array<{ properties?: GdacsItem; geometry?: { coordinates?: unknown } }> }).features;
  if (!Array.isArray(arr)) return [];
  const out: LiveEvent[] = [];
  for (const f of arr) {
    const p = f.properties || {};
    const code = (p.eventtype || "").toUpperCase();
    let type: EventType | null = null;
    if (code === "EQ") type = "quake";
    else if (code === "WF") type = "fire";
    else if (code === "FL") type = "flood";
    else if (code === "TC") type = "storm";
    if (!type) continue;
    const raw = f.geometry && (f.geometry.coordinates as unknown);
    let lat = p.latitude;
    let lng = p.longitude;
    if (Array.isArray(raw) && typeof raw[0] === "number" && typeof raw[1] === "number") {
      lng = raw[0];
      lat = raw[1];
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      id: `${type}:gdacs-${p.eventid ?? `${lat},${lng}`}`,
      type,
      title: p.name || "GDACS event",
      place: p.name || "Unknown location",
      lat: lat as number,
      lng: lng as number,
      time: gdacsTime(p),
      magnitude: null,
      severity: GDACS_SEVERITY[(p.alertlevel || "").toUpperCase()] ?? null,
      source: "GDACS",
      url: (p.url && p.url.report) || null,
    });
  }
  return out;
}

export function useLiveData() {
  const { dispatchData } = useApp();
  const store = useRef<{ quakes: LiveEvent[]; eonet: LiveEvent[]; gdacs: LiveEvent[]; newestAt: number }>({
    quakes: [],
    eonet: [],
    gdacs: [],
    newestAt: 0,
  });
  const timers = useRef<number[]>([]);

  const merge = useCallback(() => {
    const all = [...store.current.quakes, ...store.current.eonet, ...store.current.gdacs];
    all.sort((a, b) => b.time - a.time);
    // Report the time of the newest real response, not "now", so a cached
    // refresh does not masquerade as fresh data.
    dispatchData({ kind: "replace", events: all, at: store.current.newestAt || Date.now() });
  }, [dispatchData]);

  const noteAt = useCallback((at: number) => {
    if (at > store.current.newestAt) store.current.newestAt = at;
  }, []);

  const loadQuakes = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetchJson(USGS_URL, signal);
        store.current.quakes = parseQuakes(res.json as { features: UsgsFeature[] });
        store.current.gdacs = store.current.gdacs.filter((e) => e.type !== "quake");
        noteAt(res.at);
        dispatchData({ kind: "clear-error", key: "Earthquakes" });
        dispatchData({ kind: "note-refresh", key: "usgs", at: res.at });
        merge();
      } catch (err) {
        if (err && (err as Error).name === "AbortError") return;
        dispatchData({ kind: "fetch-error", key: "Earthquakes", message: "USGS earthquake feed is down — quake markers may be missing" });
      }
    },
    [dispatchData, merge, noteAt],
  );

  const loadEonet = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetchJson(EONET_URL, signal);
        store.current.eonet = parseEonet(res.json as { events?: EonetEvent[] });
        store.current.gdacs = store.current.gdacs.filter(
          (e) => e.type !== "fire" && e.type !== "flood" && e.type !== "storm",
        );
        noteAt(res.at);
        dispatchData({ kind: "clear-error", key: "Wildfires" });
        dispatchData({ kind: "clear-error", key: "Floods" });
        dispatchData({ kind: "clear-error", key: "Storms" });
        dispatchData({ kind: "note-refresh", key: "eonet", at: res.at });
        merge();
      } catch (err) {
        if (err && (err as Error).name === "AbortError") return;
        dispatchData({ kind: "fetch-error", key: "Wildfires", message: "NASA EONET feed is down — wildfire, flood and storm markers may be missing" });
      }
    },
    [dispatchData, merge, noteAt],
  );

  const loadGdacsFallback = useCallback(async () => {
    try {
      const res = await fetchJson(GDACS_URL);
      const parsed = parseGdacs(res.json);
      const haveQuakes = store.current.quakes.length > 0;
      const haveEonet = store.current.eonet.length > 0;
      store.current.gdacs = parsed.filter((e) => {
        if (e.type === "quake") return !haveQuakes;
        return !haveEonet;
      });
      noteAt(res.at);
      dispatchData({ kind: "note-refresh", key: "gdacs", at: res.at });
      merge();
      return true;
    } catch {
      return false;
    }
  }, [dispatchData, merge, noteAt]);

  const retry = useCallback(async () => {
    dispatchData({ kind: "fetch-start" });
    await Promise.all([loadQuakes(), loadEonet()]);
    await loadGdacsFallback();
  }, [dispatchData, loadQuakes, loadEonet, loadGdacsFallback]);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    dispatchData({ kind: "fetch-start" });

    const startPolling = () => {
      timers.current.forEach((t) => window.clearInterval(t));
      timers.current = [];
      if (document.visibilityState === "hidden") return;
      timers.current.push(window.setInterval(() => void loadQuakes(), QUAKE_MS));
      timers.current.push(window.setInterval(() => void loadEonet(), EONET_MS));
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        timers.current.forEach((t) => window.clearInterval(t));
        timers.current = [];
      } else {
        void loadQuakes();
        void loadEonet();
        startPolling();
      }
    };

    void (async () => {
      await Promise.all([loadQuakes(ctrl.signal), loadEonet(ctrl.signal)]);
      if (cancelled) return;
      await loadGdacsFallback();
      startPolling();
    })();

    document.addEventListener("visibilitychange", onVis);
    const onManual = () => void retry();
    window.addEventListener("live-refresh", onManual);
    return () => {
      cancelled = true;
      ctrl.abort();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("live-refresh", onManual);
      timers.current.forEach((t) => window.clearInterval(t));
      timers.current = [];
    };
  }, [dispatchData, loadQuakes, loadEonet, loadGdacsFallback, retry]);

  return { retry };
}
