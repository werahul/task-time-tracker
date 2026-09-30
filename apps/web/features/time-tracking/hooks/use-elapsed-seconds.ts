"use client";

import { useEffect, useState } from "react";

/**
 * Whole seconds since `anchorMs`, recomputed from the clock every second.
 * It is derived, never accumulated (no `elapsed++`), so throttled background
 * tabs and sleep/wake cannot make it drift.
 */
export function useElapsedSeconds(anchorMs: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (anchorMs === undefined) return;
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, 1000);
    // Catch up immediately when a hidden/sleeping tab becomes visible again.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [anchorMs]);

  return anchorMs === undefined ? 0 : Math.max(0, Math.floor((now - anchorMs) / 1000));
}
