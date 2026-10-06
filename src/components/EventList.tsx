import { useApp } from "../context/AppContext";
import type { LiveEvent } from "../types";
import { EVENT_LABEL_SINGLE } from "../types";
import { timeAgo } from "../utils/format";
import { focusEvent } from "../utils/globeController";
import styles from "./EventList.module.css";

const ROW_CAP = 150;

export default function EventList({ events, total }: { events: LiveEvent[]; total: number }) {
  const { ui, dispatchUI } = useApp();

  if (events.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No events to show</p>
      </div>
    );
  }

  const shown = events.slice(0, ROW_CAP);
  const capped = events.length > ROW_CAP;

  return (
    <div>
      <ul className={styles.list} aria-label="Events">
        {shown.map((ev) => {
          const selected = ui.selectedId === ev.id;
          return (
            <li key={ev.id}>
              <button
                type="button"
                className={`${styles.row} ${styles[ev.type]} ${selected ? styles.selected : ""}`}
                aria-current={selected ? "true" : undefined}
                onMouseEnter={() => dispatchUI({ kind: "hover", id: ev.id })}
                onMouseLeave={() => dispatchUI({ kind: "hover", id: null })}
                onFocus={() => dispatchUI({ kind: "hover", id: ev.id })}
                onClick={() => {
                  dispatchUI({ kind: "select", id: ev.id });
                  focusEvent(ev.id);
                }}
              >
                <span className={styles.bar} aria-hidden="true" />
                <span className={styles.main}>
                  <span className={styles.kind}>
                    {EVENT_LABEL_SINGLE[ev.type]}
                  </span>
                  <span className={styles.place}>{ev.place}</span>
                  <span className={`tiny ${styles.meta}`}>
                    {timeAgo(ev.time)} · {ev.source}
                  </span>
                </span>
                {ev.magnitude !== null && (
                  <span className={`mono-badge ${styles.badge}`}>{ev.magnitude.toFixed(1)}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {capped && (
        <p className="tiny">
          Showing first {ROW_CAP} of {total} matching events — narrow the filters to see more.
        </p>
      )}
    </div>
  );
}
