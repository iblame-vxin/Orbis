import { useApp } from "../context/AppContext";
import type { BaseMap } from "../types";
import { resetActiveView } from "../utils/globeController";
import styles from "./MapControls.module.css";

const BASE_OPTIONS: Array<{ id: BaseMap; label: string }> = [
  { id: "satellite", label: "Satellite" },
  { id: "streets", label: "Streets" },
  { id: "dark", label: "Dark" },
];

/**
 * Floating controls pinned to the top-right of the map area.
 * Reset view works in both modes; the base-map picker only exists in 2D.
 */
export default function MapControls() {
  const { ui, dispatchUI } = useApp();
  const is2d = ui.viewMode === "2d";

  const reset = () => {
    // Drop the selection first so the detail card closes alongside the camera.
    dispatchUI({ kind: "select", id: null });
    resetActiveView();
  };

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.reset}
        onClick={reset}
        aria-label="Reset the camera to the default view"
        title="Reset view"
      >
        <svg viewBox="0 0 16 16" className={styles.icon} aria-hidden="true" focusable="false">
          <path
            d="M13.5 8a5.5 5.5 0 1 1-1.9-4.16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
            <path
              d="M13.5 2v3.2h-3.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
        </svg>
        <span className={styles.resetLabel}>Reset view</span>
      </button>

      {is2d && (
        <div className={styles.basemaps} role="group" aria-label="Base map style">
          {BASE_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`${styles.opt} ${ui.baseMap === o.id ? styles.optOn : ""}`}
              aria-pressed={ui.baseMap === o.id}
              onClick={() => dispatchUI({ kind: "set-basemap", mode: o.id })}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
