import { formatDistanceToNow } from "date-fns";

export function timeAgo(ts: number): string {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return "unknown time";
  }
}

/**
 * Compact "Last updated" stamp: exact wording for the first hour, then falls
 * back to the relative date-fns string.
 */
export function lastUpdatedLabel(ts: number): string {
  const diff = Date.now() - ts;
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return "1 hour ago";
  if (hrs < 24) return `${hrs} hours ago`;
  return timeAgo(ts);
}

export function formatDateTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "unknown date";
  }
}

export function formatCoords(lat: number, lng: number): string {
  const la = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}`;
  const lo = `${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? "E" : "W"}`;
  return `${la}, ${lo}`;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function flagEmoji(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  const base = 0x1f1e6;
  return String.fromCodePoint(base + code.charCodeAt(0) - 65, base + code.charCodeAt(1) - 65);
}
