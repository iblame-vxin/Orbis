import { useApp } from "../context/AppContext";
import styles from "./ErrorBanner.module.css";

export default function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  const { data } = useApp();
  const keys = Object.keys(data.errors);
  if (keys.length === 0) return null;
  return (
    <div className={styles.banner} role="alert">
      {keys.map((k) => (
        <p key={k}>{data.errors[k]}</p>
      ))}
      <button type="button" className={styles.retry} onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
