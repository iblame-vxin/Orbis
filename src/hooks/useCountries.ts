import { useEffect, useState } from "react";
import type { CountryOption } from "../types";

interface CountriesDoc {
  features: Array<{
    properties: { name?: string };
    id?: string;
    geometry: unknown;
  }>;
}

export interface CountryShapes {
  options: CountryOption[];
  polysById: Map<string, Array<Array<[number, number]>>>;
  bboxById: Map<string, [number, number, number, number]>;
  features: Array<{ type: string; geometry: unknown; properties: { name: string } }>;
}

const MAJOR_COUNTRIES: CountryOption[] = [
  "United States", "Canada", "Mexico", "Brazil", "Argentina", "Chile",
  "United Kingdom", "France", "Germany", "Spain", "Italy", "Portugal",
  "Norway", "Sweden", "Greece", "Turkey", "Russia", "Ukraine",
  "Morocco", "Egypt", "Nigeria", "Kenya", "South Africa", "Ethiopia",
  "Saudi Arabia", "Iran", "Iraq", "Israel", "Pakistan", "India",
  "China", "Japan", "South Korea", "Indonesia", "Philippines", "Thailand",
  "Vietnam", "Australia", "New Zealand", "Peru", "Colombia",
].map((name) => ({ id: name, name }));

function ringList(coords: unknown): Array<[number, number]> {
  if (!Array.isArray(coords)) return [];
  return (coords as unknown[]).flatMap((pt) =>
    Array.isArray(pt) && typeof pt[0] === "number" && typeof pt[1] === "number"
      ? [[pt[0], pt[1]] as [number, number]]
      : [],
  );
}

export function useCountries() {
  const [shapes, setShapes] = useState<CountryShapes>({ options: [], polysById: new Map(), bboxById: new Map(), features: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}countries.geojson`)
      .then((r) => {
        if (!r.ok) throw new Error("countries file missing");
        return r.json() as Promise<CountriesDoc>;
      })
      .then((doc) => {
        if (cancelled) return;
        const options: CountryOption[] = [];
        const polysById = new Map<string, Array<Array<[number, number]>>>();
        const bboxById = new Map<string, [number, number, number, number]>();
        const features: CountryShapes["features"] = [];
        for (const f of doc.features || []) {
          const name = (f.properties && f.properties.name) || (typeof f.id === "string" ? f.id : null);
          if (!name) continue;
          const g = f.geometry as { type: string; coordinates: unknown } | null;
          if (!g) continue;
          const rings: Array<Array<[number, number]>> = [];
          if (g.type === "Polygon") {
            for (const ring of (g.coordinates as unknown[]) || []) {
              const pts = ringList(ring);
              if (pts.length) rings.push(pts);
            }
          } else if (g.type === "MultiPolygon") {
            for (const poly of (g.coordinates as unknown[]) || []) {
              if (!Array.isArray(poly)) continue;
              for (const ring of poly) {
                const pts = ringList(ring);
                if (pts.length) rings.push(pts);
              }
            }
          }
          if (!rings.length) continue;
          let minLng = 180;
          let minLat = 90;
          let maxLng = -180;
          let maxLat = -90;
          for (const ring of rings) {
            for (const [x, y] of ring) {
              if (x < minLng) minLng = x;
              if (x > maxLng) maxLng = x;
              if (y < minLat) minLat = y;
              if (y > maxLat) maxLat = y;
            }
          }
          options.push({ id: name, name });
          polysById.set(name, rings);
          bboxById.set(name, [minLng, minLat, maxLng, maxLat]);
          features.push({ type: "Feature", geometry: f.geometry, properties: { name } });
        }
        options.sort((a, b) => a.name.localeCompare(b.name));
        setShapes({ options, polysById, bboxById, features });
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setShapes({
          options: [...MAJOR_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)),
          polysById: new Map(),
          bboxById: new Map(),
          features: [],
        });
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { shapes, ready };
}
