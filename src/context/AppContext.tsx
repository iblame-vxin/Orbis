import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { DataState, EventType, FilterState, TimeWindow, UIState } from "../types";

type FiltersAction =
  | { kind: "toggle-layer"; layer: EventType }
  | { kind: "set-window"; window: TimeWindow }
  | { kind: "set-mag"; field: "magMin" | "magMax"; value: string }
  | { kind: "set-country"; id: string }
  | { kind: "clear-all" };

type DataAction =
  | { kind: "fetch-start" }
  | { kind: "replace"; events: import("../types").LiveEvent[]; at: number }
  | { kind: "note-refresh"; key: string; at: number }
  | { kind: "fetch-error"; key: string; message: string }
  | { kind: "clear-error"; key: string };

type UIAction =
  | { kind: "select"; id: string | null }
  | { kind: "hover"; id: string | null }
  | { kind: "flyto"; target: UIState["searchFlyTo"] }
  | { kind: "set-view"; mode: UIState["viewMode"] }
  | { kind: "set-basemap"; mode: UIState["baseMap"] };

const initialFilters: FilterState = {
  layers: { quake: true, fire: true, flood: true, storm: true },
  timeWindow: "7d",
  magMin: "",
  magMax: "",
  countryId: "",
};

const initialData: DataState = {
  events: [],
  loading: true,
  errors: {},
  lastUpdated: null,
  refreshedAt: {},
};

const initialUI: UIState = {
  selectedId: null,
  hoveredId: null,
  searchFlyTo: null,
  viewMode: "3d",
  baseMap: "satellite",
};

function filtersReducer(s: FilterState, a: FiltersAction): FilterState {
  switch (a.kind) {
    case "toggle-layer":
      return { ...s, layers: { ...s.layers, [a.layer]: !s.layers[a.layer] } };
    case "set-window":
      return { ...s, timeWindow: a.window };
    case "set-mag":
      return { ...s, [a.field]: a.value };
    case "set-country":
      return { ...s, countryId: a.id };
    case "clear-all":
      return { ...initialFilters };
    default:
      return s;
  }
}

function dataReducer(s: DataState, a: DataAction): DataState {
  switch (a.kind) {
    case "fetch-start":
      return { ...s, loading: s.events.length === 0 };
    case "note-refresh":
      return { ...s, refreshedAt: { ...s.refreshedAt, [a.key]: a.at } };
    case "replace":
      return {
        ...s,
        events: a.events,
        loading: false,
        lastUpdated: a.at,
      };
    case "fetch-error":
      return { ...s, loading: false, errors: { ...s.errors, [a.key]: a.message } };
    case "clear-error": {
      const errors = { ...s.errors };
      delete errors[a.key];
      return { ...s, errors };
    }
    default:
      return s;
  }
}

function uiReducer(s: UIState, a: UIAction): UIState {
  switch (a.kind) {
    case "select":
      return { ...s, selectedId: a.id };
    case "hover":
      return { ...s, hoveredId: a.id };
    case "flyto":
      return { ...s, searchFlyTo: a.target };
    case "set-view":
      return s.viewMode === a.mode ? s : { ...s, viewMode: a.mode, selectedId: null, hoveredId: null };
    case "set-basemap":
      return s.baseMap === a.mode ? s : { ...s, baseMap: a.mode };
    default:
      return s;
  }
}

interface AppContextValue {
  filters: FilterState;
  dispatchFilters: React.Dispatch<FiltersAction>;
  data: DataState;
  dispatchData: React.Dispatch<DataAction>;
  ui: UIState;
  dispatchUI: React.Dispatch<UIAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [filters, dispatchFilters] = useReducer(filtersReducer, initialFilters);
  const [data, dispatchData] = useReducer(dataReducer, initialData);
  const [ui, dispatchUI] = useReducer(uiReducer, initialUI);
  const value = useMemo(
    () => ({ filters, dispatchFilters, data, dispatchData, ui, dispatchUI }),
    [filters, data, ui],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
