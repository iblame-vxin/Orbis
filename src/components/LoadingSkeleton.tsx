import styles from "./LoadingSkeleton.module.css";

export default function LoadingSkeleton() {
  return (
    <div className={styles.wrap} aria-label="Loading events" role="status">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={styles.row}>
          <span className={styles.bar} />
          <span className={styles.lines}>
            <span className={styles.l1} />
            <span className={styles.l2} />
          </span>
        </div>
      ))}
    </div>
  );
}
