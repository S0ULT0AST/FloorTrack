export const COMMON_TIMEZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;

export function timezoneOptions(current?: string | null) {
  const values = new Set<string>(COMMON_TIMEZONES);
  if (current) values.add(current);
  return [...values];
}
