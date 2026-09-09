"use client";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

// The premise clock. Working-hours/days and recurring rules are defined in this
// timezone; each user sees them converted to their own device timezone.
export const PREMISE_TZ = "Asia/Muscat";

export function userTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || PREMISE_TZ;
  } catch {
    return PREMISE_TZ;
  }
}

const pad2 = (n) => String(n).padStart(2, "0");

/** Convert a daily wall-clock window in `fromTz` into the same window in
 * `toTz` (single transform — identity when fromTz === toTz). */
export function workingHoursToUserLocal(
  { startH, startM, endH, endM },
  toTz,
  fromTz = PREMISE_TZ,
) {
  const today = dayjs().format("YYYY-MM-DD");
  const start = dayjs.tz(
    `${today} ${pad2(startH)}:${pad2(startM)}`,
    fromTz,
  );
  let end = dayjs.tz(`${today} ${pad2(endH)}:${pad2(endM)}`, fromTz);
  // Overnight-style window → treat end as next day so local labels stay sane.
  if (end.isBefore(start)) end = end.add(1, "day");

  const startLocal = start.tz(toTz);
  const endLocal = end.tz(toTz);

  return {
    startH: startLocal.hour(),
    startM: startLocal.minute(),
    endH: endLocal.hour(),
    endM: endLocal.minute(),
  };
}

/** Roll an end-before-start custom window's end date to the next morning
 * (overnight visits). Presets and multi-day windows are untouched. */
export function rollOvernightEnd({ fromDate, toDate, fromTime, toTime, isPreset }) {
  if (isPreset) return toDate;
  if (!fromDate || !toDate || toDate !== fromDate) return toDate;
  if (!fromTime || !toTime || !(toTime < fromTime)) return toDate;
  return dayjs(fromDate).add(1, "day").format("YYYY-MM-DD");
}