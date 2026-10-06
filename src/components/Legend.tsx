import { useApp } from "../context/AppContext";
import styles from "./Legend.module.css";

const ITEMS_3D = [
  { key: "quake", label: "Earthquake", note: "Epicentre — taller spike means a stronger quake" },
  { key: "fire", label: "Wildfire", note: "Active fire or burned area" },
  { key: "flood", label: "Flood", note: "Ongoing or recent flooding" },
  { key: "storm", label: "Storm", note: "Tropical cyclone or severe storm" },
] as const;

const ITEMS_2D = [
  { key: "quake", label: "Earthquake", note: "Epicentre — larger dot means a stronger quake" },
  { key: "fire", label: "Wildfire", note: "Active fire or burned area" },
  { key: "flood", label: "Flood", note: "Ongoing or recent flooding" },
  { key: "storm", label: "Storm", note: "Tropical cyclone or severe storm" },
] as const;

interface Props {
  /**
   * Renders the legend as a <details> block so narrow layouts can tuck it away.
   * The desktop rail passes nothing and always shows the full list.
   */
  collapsible?: boolean;
}

export default function Legend({ collapsible = false }: Props) {
  const { filters, ui } = useApp();
  const items = ui.viewMode === "3d" ? ITEMS_3D : ITEMS_2D;

  const body = (
    <>
      <ul className={styles.items}>
        {items.map((it) => (
          <li key={it.key} className={`${styles.item} ${filters.layers[it.key] ? "" : styles.dim}`}>
            <span className={`${styles.sw} ${styles[it.key]}`} aria-hidden="true" />
            <span>
              <span className={styles.label}>{it.label}</span>
              <span className={`tiny ${styles.note}`}>{it.note}</span>
            </span>
          </li>
        ))}
        {filters.countryId && (
          <li className={styles.item}>
            <span className={`${styles.sw} ${styles.borders}`} aria-hidden="true" />
            <span>
              <span className={styles.label}>{filters.countryId}</span>
              <span className={`tiny ${styles.note}`}>Selected region outline</span>
            </span>
          </li>
        )}
      </ul>
      <p className={`tiny ${styles.foot}`}>
        Marker size reflects magnitude where the source reports it. Dimmed layers are switched off.
      </p>
    </>
  );

  if (collapsible) {
    return (
      <details className={styles.details}>
        <summary className={styles.summary}>Legend</summary>
        {body}
      </details>
    );
  }

  return (
    <section className={styles.legend} aria-label="Map legend">
      <h2 className={`section-head ${styles.head}`}>Legend</h2>
      {body}
    </section>
  );
}
