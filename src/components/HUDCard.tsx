import { EVENT_LABEL_SINGLE, type LiveEvent } from "../types";
import { timeAgo } from "../utils/format";
import styles from "./HUDCard.module.css";

export default function HUDCard({ event, onClose }: { event: LiveEvent; onClose: () => void }) {
  return (
    <div className={styles.card} role="dialog" aria-label={`Details for ${event.title}`}>
      <div className={styles.top}>
        <span className={`${styles.kind} ${styles[event.type]}`}>{EVENT_LABEL_SINGLE[event.type]}</span>
        {event.magnitude !== null && <span className={`mono-badge ${styles.badge}`}>{event.magnitude.toFixed(1)}</span>}
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close details">
          ×
        </button>
      </div>
      <p className={styles.title}>{event.title}</p>
      <p className={`mono ${styles.coords}`}>
        {Math.abs(event.lat).toFixed(4)}°{event.lat >= 0 ? "N" : "S"}{"  "}
        {Math.abs(event.lng).toFixed(4)}°{event.lng >= 0 ? "E" : "W"}
      </p>
      <p className={`small ${styles.meta}`}>
        {timeAgo(event.time)} · {event.source}
      </p>
      {event.url && (
        <a className={styles.link} href={event.url} target="_blank" rel="noopener noreferrer">
          View source report
        </a>
      )}
    </div>
  );
}
