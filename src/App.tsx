import { useLayoutEffect, useMemo } from "react";
import AttributionFooter from "./components/AttributionFooter";
import GlobeView, { type CountryFeature } from "./components/GlobeView";
import Header from "./components/Header";
import HUDCard from "./components/HUDCard";
import Legend from "./components/Legend";
import LiveStats from "./components/LiveStats";
import Map2D from "./components/Map2D";
import MapControls from "./components/MapControls";
import SidePanel from "./components/SidePanel";
import { AppProvider, useApp } from "./context/AppContext";
import { useCountries } from "./hooks/useCountries";
import { useLiveData } from "./hooks/useLiveData";
import "./styles/reset.css";
import "./styles/variables.css";
import "./styles/typography.css";
import "./styles/global.css";
import { TIME_WINDOW_MS } from "./types";
import { eventMatchesCountry } from "./utils/geo";

function Shell() {
  const { data, filters, dispatchFilters, ui, dispatchUI } = useApp();
  const { shapes } = useCountries();
  const { retry } = useLiveData();

  useLayoutEffect(() => {
    const el = document.querySelector("header");
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () =>
      document.documentElement.style.setProperty("--header-height", `${Math.round(el.getBoundingClientRect().height)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const matched = useMemo(() => {
    const now = Date.now();
    const min = filters.magMin === "" ? null : Number(filters.magMin);
    const max = filters.magMax === "" ? Number.NaN : Number(filters.magMax);
    const maxV = Number.isNaN(max) ? null : max;
    const polys = filters.countryId ? shapes.polysById.get(filters.countryId) || null : null;
    const bbox = filters.countryId ? shapes.bboxById.get(filters.countryId) || null : null;
    return data.events.filter((ev) => {
      if (!filters.layers[ev.type]) return false;
      if (filters.timeWindow !== "all" && now - ev.time > TIME_WINDOW_MS[filters.timeWindow]) return false;
      if (ev.type === "quake") {
        const m = ev.magnitude ?? 0;
        if (min !== null && Number.isFinite(min) && m < min) return false;
        if (maxV !== null && Number.isFinite(maxV) && m > maxV) return false;
      }
      if (filters.countryId && polys && bbox && !eventMatchesCountry(ev, polys, bbox)) return false;
      return true;
    });
  }, [data.events, filters, shapes]);

  const countryFeature = useMemo<CountryFeature | null>(() => {
    if (!filters.countryId) return null;
    const f = shapes.features.find((feat) => feat.properties.name === filters.countryId);
    if (!f) return null;
    return {
      type: "Feature",
      geometry: f.geometry as CountryFeature["geometry"],
      properties: { name: filters.countryId },
    };
  }, [filters.countryId, shapes]);

  const selectedEvent = useMemo(
    () => (ui.selectedId ? data.events.find((e) => e.id === ui.selectedId) || null : null),
    [ui.selectedId, data.events],
  );

  const filtersActive =
    !filters.layers.quake ||
    !filters.layers.fire ||
    !filters.layers.flood ||
    !filters.layers.storm ||
    filters.timeWindow !== "7d" ||
    filters.magMin !== "" ||
    filters.magMax !== "" ||
    filters.countryId !== "";

  return (
    <div className="app">
      <a className="skip-link" href="#events-panel">
        Skip to event list
      </a>
      <Header />
      <div className="app-body">
        <aside className="side-panel" id="events-panel" aria-label="Search, filters and event list">
          <SidePanel
            matched={matched}
            total={data.events.length}
            loading={data.loading}
            countries={shapes.options}
            onRetry={retry}
            onClear={() => dispatchFilters({ kind: "clear-all" })}
            filtersActive={filtersActive}
          />
          <div className="mobile-legend">
            <Legend collapsible />
            <LiveStats events={matched} />
            <AttributionFooter />
          </div>
        </aside>
        <main className="map-region" aria-label={ui.viewMode === "3d" ? "3D globe" : "2D map"}>
          <div className={`view-pane ${ui.viewMode === "3d" ? "" : "view-hidden"}`}>
            <GlobeView
              events={matched}
              hoveredId={ui.hoveredId}
              selectedId={ui.selectedId}
              countryFeature={countryFeature}
              onHoverEvent={(id) => dispatchUI({ kind: "hover", id })}
              onSelectEvent={(id) => dispatchUI({ kind: "select", id })}
              active={ui.viewMode === "3d"}
            />
          </div>
          <div className={`view-pane ${ui.viewMode === "2d" ? "" : "view-hidden"}`}>
            <Map2D
              events={matched}
              hoveredId={ui.hoveredId}
              selectedId={ui.selectedId}
              countryFeature={countryFeature}
              onHoverEvent={(id) => dispatchUI({ kind: "hover", id })}
              onSelectEvent={(id) => dispatchUI({ kind: "select", id })}
              active={ui.viewMode === "2d"}
              baseMap={ui.baseMap}
            />
          </div>
          <MapControls />
          {selectedEvent && <HUDCard event={selectedEvent} onClose={() => dispatchUI({ kind: "select", id: null })} />}
        </main>
        <aside className="legend-column" aria-label="Legend and attribution">
          <Legend />
          <LiveStats events={matched} />
          <AttributionFooter />
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
