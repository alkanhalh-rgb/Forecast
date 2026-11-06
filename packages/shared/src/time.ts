/**
 * Asia/Riyadh time helpers. Saudi Arabia is UTC+3 all year (no DST), so a fixed offset is exact.
 */
export const RIYADH_TZ = 'Asia/Riyadh';
export const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

/** Shifts a UTC instant so that its UTC fields read as Riyadh wall-clock fields. */
function toWall(d: Date): Date {
  return new Date(d.getTime() + RIYADH_OFFSET_MS);
}

/** Riyadh calendar day as YYYY-MM-DD. */
export function riyadhDay(d: Date): string {
  return toWall(d).toISOString().slice(0, 10);
}

/** UTC instant of 00:00 Riyadh for a YYYY-MM-DD day key. */
export function riyadhDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) - RIYADH_OFFSET_MS);
}

export function addDays(day: string, n: number): string {
  return riyadhDay(new Date(riyadhDayStart(day).getTime() + n * DAY_MS));
}

/** Whole days between two Riyadh day keys (b - a). */
export function dayDiff(a: string, b: string): number {
  return Math.round((riyadhDayStart(b).getTime() - riyadhDayStart(a).getTime()) / DAY_MS);
}

/** Start of the Riyadh week (Sunday 00:00 Riyadh) containing `d`, as a UTC instant. */
export function weekStart(d: Date): Date {
  const wall = toWall(d);
  const dow = wall.getUTCDay(); // 0 = Sunday
  const dayStartWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
  return new Date(dayStartWall - dow * DAY_MS - RIYADH_OFFSET_MS);
}

/** YYYY-MM-DD (Riyadh) of the week's Sunday. */
export function weekKey(d: Date): string {
  return riyadhDay(weekStart(d));
}

export function riyadhHour(d: Date): number {
  return toWall(d).getUTCHours();
}

/** End of the Riyadh calendar day containing `d` (next 00:00 Riyadh). */
export function endOfRiyadhDay(d: Date): Date {
  return new Date(riyadhDayStart(riyadhDay(d)).getTime() + DAY_MS);
}

/** Builds a UTC instant from Riyadh wall-clock parts. */
export function riyadhTime(day: string, hour: number, minute = 0): Date {
  return new Date(riyadhDayStart(day).getTime() + hour * HOUR_MS + minute * 60_000);
}

// ----- Quiet hours (rule 6): no notifications 23:00–07:00 Riyadh -----
export const QUIET_START_HOUR = 23;
export const QUIET_END_HOUR = 7;

export function isQuietHours(d: Date): boolean {
  const h = riyadhHour(d);
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

/** If `d` is inside quiet hours, the next 07:00 Riyadh; otherwise `d` itself. */
export function nextAllowedNotificationTime(d: Date): Date {
  if (!isQuietHours(d)) return d;
  const h = riyadhHour(d);
  const day = riyadhDay(d);
  const targetDay = h >= QUIET_START_HOUR ? addDays(day, 1) : day;
  return riyadhTime(targetDay, QUIET_END_HOUR);
}

// ----- Seasons: consecutive 6-week windows from an anchor Sunday -----
export const SEASON_WEEKS = 6;
export const DEFAULT_SEASON_ANCHOR = '2026-01-04'; // a Sunday (Riyadh)

export function seasonWindow(d: Date, anchorDay = DEFAULT_SEASON_ANCHOR): { index: number; startsAt: Date; endsAt: Date } {
  const anchor = riyadhDayStart(anchorDay).getTime();
  const len = SEASON_WEEKS * WEEK_MS;
  const index = Math.floor((d.getTime() - anchor) / len);
  const startsAt = new Date(anchor + index * len);
  return { index, startsAt, endsAt: new Date(startsAt.getTime() + len) };
}
