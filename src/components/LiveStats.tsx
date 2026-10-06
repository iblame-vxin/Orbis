import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { EVENT_LABEL, type EventType, type LiveEvent } from "../types";
import { formatCount, lastUpdatedLabel } from "../utils/format";
import styles from "./LiveStats.module.css";

const ORDER: EventType[] = ["quake", "fire", "flood", "storm"];
const WINDOW_LABEL: Record<string, string> = { "24h": "24h", "7d": "7d", "30d": "30d", all: "all" };

interface Props {
  events: LiveEvent[];
}

export default function LiveStats({ events }: Props) {
  const { filters, data } = useApp();
  // Re-render on a timer so the relative "last updated" stamp stays truthful
  // even between refreshes.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const visible = ORDER.filter((t) => filters.layers[t]);
  const counts = new Map<EventType, number>();
  for (const e of events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  const windowLabel = WINDOW_LABEL[filters.timeWindow] ?? filters.timeWindow;
  return (
    <section className={styles.stats} aria-label="Live event counts">
      <p className={`mono ${styles.total}`} aria-live="polite">
        {formatCount(events.length)} events · {windowLabel}
      </p>
      <ul className={styles.rows}>
        {visible.map((t) => (
          <li key={t} className={styles.row}>
            <span className={`${styles.dot} ${styles[t]}`} aria-hidden="true" />
            <span className={styles.name}>{EVENT_LABEL[t]}</span>
            <span className={`mono ${styles.count}`}>{formatCount(counts.get(t) ?? 0)}</span>
          </li>
        ))}
      </ul>
      <p className={`tiny ${styles.updated}`}>
        {data.lastUpdated ? `Last updated: ${lastUpdatedLabel(data.lastUpdated)}` : "Waiting for the first update…"}
      </p>
    </section>
  );
}
