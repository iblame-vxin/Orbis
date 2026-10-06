export type EventType = "quake" | "fire" | "flood" | "storm";

export type DataSource = "USGS" | "EONET" | "GDACS";

export interface LiveEvent {
  id: string;
  type: EventType;
  title: string;
  place: string;
  lat: number;
  lng: number;
  time: number;
  magnitude: number | null;
  /**
   * Optional 0–1 severity for sources that publish an alert level but no
   * magnitude (GDACS reports GREEN / ORANGE / RED). Null where unavailable.
   */
  severity: number | null;
  source: DataSource;
  url: string | null;
}

export type TimeWindow = "24h" | "7d" | "30d" | "all";

export interface FilterState {
  layers: Record<EventType, boolean>;
  timeWindow: TimeWindow;
  magMin: string;
  magMax: string;
  countryId: string;
}

export interface DataState {
  events: LiveEvent[];
  loading: boolean;
  errors: Partial<Record<string, string>>;
  lastUpdated: number | null;
  refreshedAt: Record<string, number>;
}

export type ViewMode = "3d" | "2d";

/** Base layers available on the 2D map. */
export type BaseMap = "satellite" | "streets" | "dark";

export interface UIState {
  selectedId: string | null;
  hoveredId: string | null;
  searchFlyTo: { lat: number; lng: number; bbox: [number, number, number, number] | null } | null;
  viewMode: ViewMode;
  baseMap: BaseMap;
}

export interface CountryOption {
  id: string;
  name: string;
}

export interface GeoResult {
  displayName: string;
  name: string;
  countryCode: string;
  lat: number;
  lng: number;
  bbox: [number, number, number, number] | null;
}

export const MAP_NONQUAKE_CAP = 400;

export const EVENT_LABEL: Record<EventType, string> = {
  quake: "Earthquakes",
  fire: "Wildfires",
  flood: "Floods",
  storm: "Storms",
};

export const EVENT_LABEL_SINGLE: Record<EventType, string> = {
  quake: "Earthquake",
  fire: "Wildfire",
  flood: "Flood",
  storm: "Storm",
};

export const TIME_WINDOW_MS: Record<Exclude<TimeWindow, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};
