/**
 * Centralized Timezone Utilities for Quietcare.
 * Default and standard timezone: Asia/Kolkata (IST, UTC+05:30).
 */

export const APP_TIMEZONE = "Asia/Kolkata";

/**
 * Returns components of the given date (or now) in Asia/Kolkata timezone.
 */
export function getISTDateParts(d: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  datePrefix: string;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const findPart = (type: string) => parts.find((p) => p.type === type)?.value || "";

  const year = parseInt(findPart("year") || "2026", 10);
  const month = parseInt(findPart("month") || "09", 10);
  const day = parseInt(findPart("day") || "06", 10);
  const hour = parseInt(findPart("hour") || "0", 10);
  const minute = parseInt(findPart("minute") || "0", 10);
  const second = parseInt(findPart("second") || "0", 10);

  const datePrefix = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return { year, month, day, datePrefix, hour, minute, second };
}

/**
 * Creates an ISO 8601 string with Asia/Kolkata offset (+05:30).
 * e.g., "2026-09-06T19:30:00+05:30"
 */
export function createISTIsoString(
  datePrefix: string,
  hour: number,
  minute: number,
  second: number = 0
): string {
  const h = String(hour).padStart(2, "0");
  const m = String(minute).padStart(2, "0");
  const s = String(second).padStart(2, "0");
  return `${datePrefix}T${h}:${m}:${s}+05:30`;
}

/**
 * Returns the current time in IST formatted as an ISO 8601 string with +05:30 offset.
 */
export function getISTNowIso(): string {
  const parts = getISTDateParts();
  return createISTIsoString(parts.datePrefix, parts.hour, parts.minute, parts.second);
}

/**
 * Formats any ISO string or Date object into human-readable IST time (e.g., "7:30 PM").
 */
export function formatISTTime(dateOrIso: string | Date | undefined): string {
  if (!dateOrIso) return "";
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(d.getTime())) return "";

  return d.toLocaleTimeString("en-IN", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Formats any ISO string or Date object into IST date (e.g., "Sep 6" or "Sep 6, 2026").
 */
export function formatISTDate(
  dateOrIso: string | Date | undefined,
  includeYear: boolean = false
): string {
  if (!dateOrIso) return "";
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(d.getTime())) return "";

  return d.toLocaleDateString("en-IN", {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

/**
 * Formats any ISO string or Date object into full IST datetime (e.g., "7:30 PM, Sep 6").
 */
export function formatISTDateTime(dateOrIso: string | Date | undefined): string {
  if (!dateOrIso) return "";
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(d.getTime())) return "";

  return `${formatISTTime(d)}, ${formatISTDate(d)}`;
}

/**
 * Determines whether a given ISO date falls on "today" in IST.
 */
export function isTodayIST(dateOrIso: string | Date | undefined): boolean {
  if (!dateOrIso) return false;
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(d.getTime())) return false;

  const todayParts = getISTDateParts();
  const targetParts = getISTDateParts(d);

  return (
    todayParts.year === targetParts.year &&
    todayParts.month === targetParts.month &&
    todayParts.day === targetParts.day
  );
}
