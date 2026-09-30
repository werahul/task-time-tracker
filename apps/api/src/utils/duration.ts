const UNIT_SECONDS = { s: 1, m: 60, h: 60 * 60, d: 24 * 60 * 60 } as const;

export const DURATION_PATTERN = /^(\d+)([smhd])$/;

/** Converts a duration like "15m" or "7d" into whole seconds. */
export function parseDurationToSeconds(value: string): number {
  const match = DURATION_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid duration "${value}"`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_SECONDS[unit as keyof typeof UNIT_SECONDS];
}
