import { useApp } from "../context/AppContext";
import styles from "./Header.module.css";

/** Which provider each error key belongs to, for the compact status line. */
const KEY_TO_SOURCE: Record<string, string> = {
  Earthquakes: "USGS",
  Wildfires: "NASA EONET",
  Floods: "NASA EONET",
  Storms: "NASA EONET",
};

export default function Header() {
  const { ui, dispatchUI, data } = useApp();
  const is3d = ui.viewMode === "3d";
  const refresh = () => window.dispatchEvent(new CustomEvent("live-refresh"));
  const pick = (mode: "3d" | "2d") => () => dispatchUI({ kind: "set-view", mode });

  const downSources = [...new Set(Object.keys(data.errors).map((k) => KEY_TO_SOURCE[k] ?? k))];
  // Green once at least one feed has landed, amber while the very first load runs,
  // red as soon as any source reports a failure.
  const status = downSources.length > 0 ? "error" : data.events.length > 0 ? "ok" : "loading";
  const statusText =
    status === "loading"
      ? "Connecting to live feeds…"
      : status === "error"
        ? `${downSources.join(" + ")} unavailable — showing the rest`
        : "Live data: USGS · NASA EONET · GDACS";

  return (
    <header className={styles.header}>
      <a className={styles.brand} href="#" onClick={(e) => e.preventDefault()} aria-label="Orbis home">
        <svg className={styles.mark} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
          <circle cx="20" cy="20" r="9" fill="#D4C4A8" />
          <ellipse cx="20" cy="20" rx="17" ry="7" fill="none" stroke="#8A93A3" strokeWidth="1.5" transform="rotate(-24 20 20)" />
          <circle cx="34" cy="13" r="2" fill="#E8EAF0" />
        </svg>
        <span className={styles.titleWrap}>
          <span className={`title ${styles.title}`}>Orbis</span>
          <span className={styles.mission}>The world in one lens</span>
        </span>
      </a>

      <div className={styles.viewToggle} role="group" aria-label="Map view">
        <button
          type="button"
          className={`${styles.viewBtn} ${is3d ? styles.viewOn : ""}`}
          aria-pressed={is3d}
          aria-label="Switch to 3D globe view"
          onClick={pick("3d")}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={styles.viewIcon}>
            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <ellipse cx="8" cy="8" rx="6" ry="2.4" fill="none" stroke="currentColor" strokeWidth="1.1" />
          </svg>
          <span className={styles.long}>3D Globe</span>
          <span className={styles.short}>3D</span>
        </button>
        <button
          type="button"
          className={`${styles.viewBtn} ${!is3d ? styles.viewOn : ""}`}
          aria-pressed={!is3d}
          aria-label="Switch to 2D map view"
          onClick={pick("2d")}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={styles.viewIcon}>
            <rect x="2" y="3" width="12" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M2 8h12M8 3v10" stroke="currentColor" strokeWidth="1.1" fill="none" />
          </svg>
          <span className={styles.long}>2D Map</span>
          <span className={styles.short}>2D</span>
        </button>
      </div>

      <nav className={styles.nav} aria-label="Data sources">
        <span className={styles.liveDot} data-state={status} aria-hidden="true" />
        <span className={`tiny ${styles.full}`}>{statusText}</span>
        <button type="button" className={styles.refresh} onClick={refresh} aria-label="Refresh live data">
          Refresh
        </button>
      </nav>
    </header>
  );
}
