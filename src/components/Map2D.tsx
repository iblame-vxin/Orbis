import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoJsonObject } from "geojson";
import type { BaseMap, LiveEvent } from "../types";
import { MAP_NONQUAKE_CAP } from "../types";
import { reducedMotion, registerGlobe, syncGlobeEvents, type BBox } from "../utils/globeController";
import type { CountryFeature } from "./GlobeView";
import styles from "./Map2D.module.css";

interface Props {
  events: LiveEvent[];
  hoveredId: string | null;
  selectedId: string | null;
  countryFeature: CountryFeature | null;
  onHoverEvent: (id: string | null) => void;
  onSelectEvent: (id: string | null) => void;
  active: boolean;
  baseMap: BaseMap;
}

const TYPE_COLOR: Record<LiveEvent["type"], string> = {
  quake: "#E85D4A",
  fire: "#F39C12",
  flood: "#3FA7D6",
  storm: "#BB7AE0",
};
const ACCENT = "#D4C4A8";
const OUTLINE = "rgba(3,5,10,0.9)";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const LABELS = `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`;

/** Framing used on first load and again by the Reset view button. */
const INITIAL_CENTER: L.LatLngExpression = [18, 6];
const INITIAL_ZOOM = 2;

interface BaseLayerDef {
  url: string;
  attribution: string;
  /** Highest zoom the provider actually has tiles for. */
  maxNativeZoom: number;
  /** Whether the separate reference layer should be stacked on top. */
  labels: boolean;
}

/**
 * Three base maps, all keyless ArcGIS REST endpoints. Satellite is the default
 * and matches the look of the 3D globe; Streets is the lighter, more readable
 * option; Dark sits closest to the app's own colour scheme.
 */
const BASE_LAYERS: Record<BaseMap, BaseLayerDef> = {
  satellite: {
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    attribution: "Tiles © Esri — Maxar, Earthstar Geographics, USGS",
    maxNativeZoom: 18,
    labels: true,
  },
  streets: {
    url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: "Tiles © Esri — HERE, Garmin, © OpenStreetMap contributors",
    maxNativeZoom: 18,
    labels: false,
  },
  dark: {
    url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    attribution: "Tiles © Esri — HERE, Garmin, © OpenStreetMap contributors",
    // The dark canvas stops at z16; Leaflet upscales past that.
    maxNativeZoom: 16,
    labels: true,
  },
};

interface MarkerEntry {
  marker: L.CircleMarker;
  base: number;
  type: LiveEvent["type"];
}

function zoomForAltitude(rel: number): number {
  const z = 5.04 - 2.684 * Math.log(Math.max(0.001, rel));
  return Math.min(18, Math.max(2, Math.round(z)));
}

function radiusFor(ev: LiveEvent): number {
  if (ev.type !== "quake") return 6.5;
  return 3 + (ev.magnitude ?? 0);
}

export default function Map2D({
  events,
  hoveredId,
  selectedId,
  countryFeature,
  onHoverEvent,
  onSelectEvent,
  active,
  baseMap,
}: Props) {
  const holder = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const renderer = useRef<L.Canvas | null>(null);
  const markers = useRef(new Map<string, MarkerEntry>());
  const markerGroup = useRef<L.LayerGroup | null>(null);
  const countryLayer = useRef<L.GeoJSON | null>(null);
  const tileLayers = useRef<{ base: L.TileLayer | null; labels: L.TileLayer | null }>({
    base: null,
    labels: null,
  });
  const lastSel = useRef<string | null>(selectedId);
  const lastHov = useRef<string | null>(hoveredId);
  const callbacks = useRef({ onHoverEvent, onSelectEvent });
  const live = useRef({ selectedId, hoveredId, events });

  useEffect(() => {
    callbacks.current = { onHoverEvent, onSelectEvent };
    live.current = { selectedId, hoveredId, events };
  });

  useEffect(() => {
    if (!holder.current) return;
    const map = L.map(holder.current, {
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: 2,
      maxZoom: 18,
      worldCopyJump: true,
    });
    map.attributionControl.setPrefix("");
    renderer.current = L.canvas({ padding: 0.4 });
    mapRef.current = map;

    map.on("click", () => callbacks.current.onSelectEvent(null));

    return () => {
      mapRef.current = null;
      renderer.current = null;
      markerGroup.current = null;
      countryLayer.current = null;
      tileLayers.current = { base: null, labels: null };
      map.remove();
    };
  }, []);

  // Tiles are only requested once the 2D pane is the one on screen, and are
  // swapped when the user picks a different base map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !active) return;
    const def = BASE_LAYERS[baseMap];
    const prev = tileLayers.current;
    if (prev.base) map.removeLayer(prev.base);
    if (prev.labels) map.removeLayer(prev.labels);

    const base = L.tileLayer(def.url, {
      attribution: def.attribution,
      maxZoom: 18,
      maxNativeZoom: def.maxNativeZoom,
      keepBuffer: 3,
    }).addTo(map);

    let labels: L.TileLayer | null = null;
    if (def.labels) {
      labels = L.tileLayer(LABELS, {
        maxZoom: 18,
        maxNativeZoom: 18,
        opacity: 0.85,
        keepBuffer: 3,
        pane: "overlayPane",
      }).addTo(map);
    }
    tileLayers.current = { base, labels };
  }, [active, baseMap]);

  useEffect(() => {
    if (!active) return;
    const map = mapRef.current;
    if (!map) return;
    const motionOK = !reducedMotion();
    registerGlobe("2d", {
      flyTo: (lat: number, lng: number, relAltitude = 0.7, bbox: BBox | null = null) => {
        if (bbox) {
          const bounds = L.latLngBounds([bbox[0], bbox[1]], [bbox[2], bbox[3]]);
          if (bounds.isValid()) {
            if (motionOK) map.flyToBounds(bounds, { padding: [48, 48], duration: 0.9, maxZoom: 12 });
            else map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
            return;
          }
        }
        const zoom = zoomForAltitude(relAltitude);
        if (motionOK) map.flyTo([lat, lng], zoom, { duration: 0.9, easeLinearity: 0.22 });
        else map.setView([lat, lng], zoom, { animate: false });
      },
      reset: () => {
        if (motionOK) map.flyTo(INITIAL_CENTER, INITIAL_ZOOM, { duration: 0.9 });
        else map.setView(INITIAL_CENTER, INITIAL_ZOOM, { animate: false });
      },
    });
    return () => registerGlobe("2d", null);
  }, [active]);

  useEffect(() => {
    syncGlobeEvents(events);
  }, [events]);

  useEffect(() => {
    const map = mapRef.current;
    const canvas = renderer.current;
    if (!map || !canvas) return;

    if (markerGroup.current) {
      map.removeLayer(markerGroup.current);
      markerGroup.current = null;
    }

    const group = L.layerGroup();
    const seen: Record<string, number> = {};
    markers.current.clear();

    for (const ev of events) {
      if (ev.type !== "quake") {
        seen[ev.type] = (seen[ev.type] || 0) + 1;
        if ((seen[ev.type] as number) > MAP_NONQUAKE_CAP) continue;
      }
      const isSel = ev.id === live.current.selectedId;
      const isHov = ev.id === live.current.hoveredId;
      const base = radiusFor(ev);
      const marker = L.circleMarker([ev.lat, ev.lng], {
        renderer: canvas,
        radius: base * (isSel ? 1.5 : isHov ? 1.25 : 1),
        color: OUTLINE,
        weight: isSel ? 2.4 : 1.4,
        fillColor: isSel ? ACCENT : isHov ? "#FFFFFF" : TYPE_COLOR[ev.type],
        fillOpacity: 0.92,
        bubblingMouseEvents: false,
      });
      marker.on("mouseover", () => callbacks.current.onHoverEvent(ev.id));
      marker.on("mouseout", () => callbacks.current.onHoverEvent(null));
      marker.on("click", (e) => {
        if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
        callbacks.current.onSelectEvent(ev.id);
      });
      group.addLayer(marker);
      markers.current.set(ev.id, { marker, base, type: ev.type });
    }
    group.addTo(map);
    markerGroup.current = group;
  }, [events]);

  useEffect(() => {
    const changed = new Set<string>();
    if (lastSel.current !== selectedId) {
      if (lastSel.current) changed.add(lastSel.current);
      if (selectedId) changed.add(selectedId);
      lastSel.current = selectedId;
    }
    if (lastHov.current !== hoveredId) {
      if (lastHov.current) changed.add(lastHov.current);
      if (hoveredId) changed.add(hoveredId);
      lastHov.current = hoveredId;
    }
    for (const id of changed) {
      const entry = markers.current.get(id);
      if (!entry) continue;
      const isSel = id === selectedId;
      const isHov = id === hoveredId;
      entry.marker.setRadius(entry.base * (isSel ? 1.5 : isHov ? 1.25 : 1));
      entry.marker.setStyle({
        color: OUTLINE,
        weight: isSel ? 2.4 : 1.4,
        fillColor: isSel ? ACCENT : isHov ? "#FFFFFF" : TYPE_COLOR[entry.type],
      });
      if (isSel) entry.marker.bringToFront();
    }
  }, [selectedId, hoveredId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (countryLayer.current) {
      map.removeLayer(countryLayer.current);
      countryLayer.current = null;
    }
    if (!countryFeature) return;
    const layer = L.geoJSON(countryFeature as unknown as GeoJsonObject, {
      interactive: false,
      style: {
        color: ACCENT,
        weight: 1.6,
        opacity: 0.8,
        fillColor: ACCENT,
        fillOpacity: 0.07,
      },
    }).addTo(map);
    countryLayer.current = layer;
  }, [countryFeature]);

  return <div ref={holder} className={styles.map} />;
}
