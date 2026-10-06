import { useState } from "react";
import { EVENT_LABEL, MAP_NONQUAKE_CAP, type CountryOption, type EventType, type LiveEvent } from "../types";
import ErrorBanner from "./ErrorBanner";
import EventList from "./EventList";
import { LayerToggles, MagnitudeFilter, RegionFilter, TimeFilter } from "./Filters";
import LoadingSkeleton from "./LoadingSkeleton";
import SearchBox from "./SearchBox";
import styles from "./SidePanel.module.css";
import { formatCount } from "../utils/format";

interface Props {
  matched: LiveEvent[];
  total: number;
  loading: boolean;
  countries: CountryOption[];
  onRetry: () => void;
  onClear: () => void;
  filtersActive: boolean;
}

type SheetState = "half" | "tall" | "closed";
const SHEET_LABEL: Record<SheetState, string> = {
  half: "Expand panel taller",
  tall: "Collapse filter panel",
  closed: "Expand filter panel",
};
const SHEET_NEXT: Record<SheetState, SheetState> = {
  half: "tall",
  tall: "closed",
  closed: "half",
};

export default function SidePanel({ matched, total, loading, countries, onRetry, onClear, filtersActive }: Props) {
  const [sheet, setSheet] = useState<SheetState>("half");
  const capNotes = (["fire", "flood", "storm"] as EventType[])
    .map((t) => {
      const n = matched.filter((e) => e.type === t).length;
      return n > MAP_NONQUAKE_CAP
        ? `Showing ${formatCount(MAP_NONQUAKE_CAP)} of ${formatCount(n)} ${EVENT_LABEL[t].toLowerCase()} on map`
        : null;
    })
    .filter((s): s is string => s !== null);
  const outage = !loading && total === 0 && !filtersActive;
  return (
    <div className={styles.panel} data-sheet={sheet}>
      <button
        type="button"
        className={`sheet-handle-row ${styles.handleRow}`}
        aria-expanded={sheet !== "closed"}
        aria-label={SHEET_LABEL[sheet]}
        onClick={() => setSheet((s) => SHEET_NEXT[s])}
      >
        <span className={styles.handle} aria-hidden="true" />
      </button>
      <h2 className={`section-head ${styles.head}`}>Explore events</h2>
      <div className={styles.collapsible}>
      <ErrorBanner onRetry={onRetry} />
      <SearchBox />
      <LayerToggles />
      <TimeFilter />
      <MagnitudeFilter />
      <RegionFilter options={countries} />
      <div className={styles.countRow}>
        <p className="count-line" aria-live="polite">
          {total === 0
            ? "Showing — of — events"
            : `Showing ${formatCount(matched.length)} of ${formatCount(total)} events`}
        </p>
        {capNotes.map((note) => (
          <p key={note} className="count-line">
            {note}
          </p>
        ))}
        {filtersActive && matched.length > 0 && (
          <button type="button" className={styles.clear} onClick={onClear}>
            Clear all filters
          </button>
        )}
      </div>
      {loading ? (
        <LoadingSkeleton />
      ) : matched.length === 0 ? (
        <div className={styles.emptyWrap}>
          {outage ? (
            <>
              <p>No live data yet — check your connection and try again</p>
              <button type="button" className={styles.clearBtn} onClick={onRetry}>
                Retry
              </button>
            </>
          ) : filtersActive ? (
            <>
              <p>No events match your filters</p>
              <button type="button" className={styles.clearBtn} onClick={onClear}>
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p>No events in the selected time window</p>
              <button type="button" className={styles.clearBtn} onClick={onRetry}>
                Retry
              </button>
            </>
          )}
        </div>
      ) : (
        <EventList events={matched} total={matched.length} />
      )}
      </div>
    </div>
  );
}
