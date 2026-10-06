import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { useGeocoding } from "../hooks/useGeocoding";
import { flagEmoji } from "../utils/format";
import { flyToSearch } from "../utils/globeController";
import styles from "./SearchBox.module.css";

export default function SearchBox() {
  const { dispatchUI } = useApp();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const { results, searching, queried } = useGeocoding(query);
  const showEmpty = open && !searching && queried.length >= 2 && results.length === 0;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (i: number) => {
    const r = results[i];
    if (!r) return;
    setOpen(false);
    setQuery(r.name);
    dispatchUI({ kind: "flyto", target: { lat: r.lat, lng: r.lng, bbox: r.bbox } });
    flyToSearch(r.lat, r.lng, r.bbox);
  };

  return (
    <div className={styles.box} ref={boxRef}>
      <label className={styles.label} htmlFor="place-search">
        Search places
      </label>
      <input
        id="place-search"
        className={styles.input}
        type="search"
        placeholder="Search a city or country…"
        value={query}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="place-results"
        aria-autocomplete="list"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && results.length > 0) pick(0);
        }}
      />
      {searching && <p className="tiny">Searching…</p>}
      {showEmpty && <p className="tiny">No places found — try a country name</p>}
      {open && results.length > 0 && (
        <ul id="place-results" role="listbox" className={styles.results} aria-label="Search results">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lng}-${i}`} role="option" aria-selected="false">
              <button type="button" className={styles.result} onClick={() => pick(i)}>
                <span aria-hidden="true">{flagEmoji(r.countryCode) || "📍"}</span>
                <span>
                  <span className={styles.resultName}>{r.name}</span>
                  <span className={`tiny ${styles.resultFull}`}>{r.displayName}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
