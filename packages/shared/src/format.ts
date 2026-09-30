/**
 * Human-readable duration, shared so the API's summary text and the UI format
 * time identically: 45 → "45s", 720 → "12m", 4800 → "1h 20m", 11100 → "3h 05m".
 */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}
