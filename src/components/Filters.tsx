import { useApp } from "../context/AppContext";
import type { CountryOption } from "../types";
import { EVENT_LABEL, type EventType, type TimeWindow } from "../types";
import styles from "./Filters.module.css";

const LAYERS: EventType[] = ["quake", "fire", "flood", "storm"];
const WINDOWS: TimeWindow[] = ["24h", "7d", "30d", "all"];
const WINDOW_LABEL: Record<TimeWindow, string> = {
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
  all: "All",
};

export function LayerToggles() {
  const { filters, dispatchFilters } = useApp();
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Layers</legend>
      <div className={styles.chips}>
        {LAYERS.map((l) => (
          <button
            key={l}
            type="button"
            className={`${styles.chip} ${styles[l]} ${filters.layers[l] ? styles.on : ""}`}
            aria-pressed={filters.layers[l]}
            onClick={() => dispatchFilters({ kind: "toggle-layer", layer: l })}
          >
            <span className={styles.dot} aria-hidden="true" />
            {EVENT_LABEL[l]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function TimeFilter() {
  const { filters, dispatchFilters } = useApp();
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Time window</legend>
      <div className={styles.segment} role="group" aria-label="Time window">
        {WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            className={`${styles.seg} ${filters.timeWindow === w ? styles.segOn : ""}`}
            aria-pressed={filters.timeWindow === w}
            onClick={() => dispatchFilters({ kind: "set-window", window: w })}
          >
            {WINDOW_LABEL[w]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function MagnitudeFilter() {
  const { filters, dispatchFilters } = useApp();
  const quakesOn = filters.layers.quake;
  return (
    <fieldset className={styles.group} aria-disabled={!quakesOn}>
      <legend className={styles.legend}>Magnitude range</legend>
      <div className={`${styles.magRow} ${quakesOn ? "" : styles.disabled}`} aria-hidden={false}>
        <div className={styles.magField}>
          <label htmlFor="mag-min">Min</label>
          <input
            id="mag-min"
            className="mono"
            type="number"
            min={0}
            max={10}
            step={0.1}
            inputMode="decimal"
            placeholder="2.5"
            value={filters.magMin}
            disabled={!quakesOn}
            onChange={(e) => dispatchFilters({ kind: "set-mag", field: "magMin", value: e.target.value })}
          />
        </div>
        <div className={styles.magField}>
          <label htmlFor="mag-max">Max</label>
          <input
            id="mag-max"
            className="mono"
            type="number"
            min={0}
            max={10}
            step={0.1}
            inputMode="decimal"
            placeholder="10"
            value={filters.magMax}
            disabled={!quakesOn}
            onChange={(e) => dispatchFilters({ kind: "set-mag", field: "magMax", value: e.target.value })}
          />
        </div>
      </div>
      <p className={`tiny ${styles.hint}`}>
        <strong>Earthquakes only.</strong>{" "}
        {quakesOn ? "Ignores wildfires, floods and storms." : "Disabled while the Earthquakes layer is off."}
      </p>
    </fieldset>
  );
}

export function RegionFilter({ options }: { options: CountryOption[] }) {
  const { filters, dispatchFilters } = useApp();
  return (
    <div className={styles.group}>
      <label className={styles.legend} htmlFor="country-select">
        Region
      </label>
      <select
        id="country-select"
        className={styles.select}
        value={filters.countryId}
        onChange={(e) => dispatchFilters({ kind: "set-country", id: e.target.value })}
      >
        <option value="">All countries</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
