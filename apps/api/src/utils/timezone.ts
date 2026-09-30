/** True for IANA zone names this runtime recognizes, e.g. "UTC", "Asia/Kolkata". */
export function isValidTimeZone(value: string): boolean {
  if (!/^[A-Za-z0-9_+\-/]{1,64}$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
