import { useEffect, useRef, useState } from "react";
import type { GeoResult } from "../types";
import { useDebounce } from "./useDebounce";

interface NominatimItem {
  display_name: string;
  name?: string;
  address?: { country_code?: string };
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
}

const cache = new Map<string, GeoResult[]>();

export function useGeocoding(query: string) {
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounced = useDebounce(query.trim(), 300);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    if (debounced.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const cached = cache.get(debounced.toLowerCase());
    if (cached) {
      setResults(cached);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearching(true);
    const url =
      "https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=" +
      encodeURIComponent(debounced);
    fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } })
      .then((r) => {
        if (!r.ok) throw new Error("search failed");
        return r.json() as Promise<NominatimItem[]>;
      })
      .then((items) => {
        const mapped: GeoResult[] = (items || []).map((it) => {
          let bbox: GeoResult["bbox"] = null;
          if (it.boundingbox && it.boundingbox.length === 4) {
            const s = Number(it.boundingbox[0]);
            const n = Number(it.boundingbox[1]);
            const w = Number(it.boundingbox[2]);
            const e = Number(it.boundingbox[3]);
            if ([s, n, w, e].every((v) => Number.isFinite(v))) bbox = [s, w, n, e];
          }
          return {
            displayName: it.display_name,
            name: it.name || it.display_name.split(",")[0],
            countryCode: (it.address && it.address.country_code) || "",
            lat: Number(it.lat),
            lng: Number(it.lon),
            bbox,
          };
        });
        cache.set(debounced.toLowerCase(), mapped);
        setResults(mapped);
      })
      .catch((err) => {
        if (err && err.name !== "AbortError") setResults([]);
      })
      .finally(() => {
        if (abortRef.current === ctrl) setSearching(false);
      });
    return () => ctrl.abort();
  }, [debounced]);

  return { results, searching, queried: debounced };
}
