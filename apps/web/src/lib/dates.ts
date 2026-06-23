import {
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  isThisYear,
} from "date-fns";

/**
 * Date helpers — centralizes formatting so we have one vocabulary across the app
 * and don't pass `Intl.DateTimeFormat` instances through component props.
 *
 * All helpers accept either an ISO string or a Date.
 */

function asDate(value: string | Date): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** "May 8, 2026" — full date, used for "Created" rows and other meta. */
export function formatDate(value: string | Date): string {
  return format(asDate(value), "MMM d, yyyy");
}

/** "May 8" — short date, used in compact workspace lists. */
export function formatDateShort(value: string | Date): string {
  return format(asDate(value), "MMM d");
}

/**
 * "May 8, 14:30" (current year) or "May 8, 2024" (prior years).
 * Used for absolute timestamps on older comments / history.
 */
export function formatDateTime(value: string | Date): string {
  const d = asDate(value);
  return isThisYear(d) ? format(d, "MMM d, HH:mm") : format(d, "MMM d, yyyy");
}

/** "May 8, 2026, 14:30" — full timestamp for tooltips and assistive labels. */
export function formatDateTimeFull(value: string | Date): string {
  return format(asDate(value), "MMM d, yyyy, HH:mm");
}

/**
 * Relative for recent, absolute for older. Sweet spot for activity feeds.
 *   - < 7 days: "5 minutes ago", "yesterday", "3 days ago"
 *   - >= 7 days: "May 8, 14:30" (or "May 8, 2024" if prior year)
 *
 * Pair with {@link formatDateTime} for the tooltip / aria-label so users always
 * have access to the precise time on hover.
 */
export function formatRelative(value: string | Date): string {
  const d = asDate(value);
  if (Math.abs(differenceInCalendarDays(new Date(), d)) < 7) {
    return formatDistanceToNow(d, { addSuffix: true });
  }
  return formatDateTime(d);
}

/**
 * Local-timezone "yyyy-MM-dd" — for default names like "Release-2026-05-08"
 * where the user expects today's date in their own timezone, not UTC.
 */
export function formatDayKey(value: string | Date = new Date()): string {
  return format(asDate(value), "yyyy-MM-dd");
}
