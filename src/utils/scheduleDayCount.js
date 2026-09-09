import dayjs from "dayjs";

function resolveScheduleRange({ preset, startDate, endDate }) {
  const base = startDate ? dayjs(startDate) : null;
  if (!base || !base.isValid()) return null;
  const from = base.clone().startOf("day");
  if (preset === "fullDay") return { from, to: base.clone().endOf("day") };
  if (preset === "fullWeek") {
    return { from, to: base.clone().add(6, "days").endOf("day") };
  }
  if (preset === "fullMonth") {
    return { from, to: base.clone().endOf("month") };
  }
  const end =
    endDate && dayjs(endDate).isValid()
      ? dayjs(endDate).clone().endOf("day")
      : base.clone().add(30, "days").endOf("day");
  return { from, to: end };
}

/**
 * Count how many distinct calendar days a schedule actually covers.
 * Mirrors the from/to + weekday derivation used by the create/approve submit
 * handlers so auto-Enable-Multiple-Check-ins matches exactly what gets stored.
 *
 * @param {object} cfg
 * @param {boolean} cfg.isPreset - recognised preset scheduling is active
 * @param {string}  cfg.preset   - "fullDay" | "fullWeek" | "fullMonth" | "specificDays"
 * @param {any}     cfg.startDate - base date (dayjs/date/string)
 * @param {any}     cfg.endDate   - for specificDays (dayjs/date/string, nullable)
 * @param {number[]} cfg.weekdays - weekday indices [0=Sun..6=Sat] included in the range
 * @returns {number}
 */
export function countScheduledDays({ isPreset, preset, startDate, endDate, weekdays }) {
  if (!isPreset || preset === "fullDay") return 1;
  const range = resolveScheduleRange({ preset, startDate, endDate });
  if (!range) return 1;
  if (!Array.isArray(weekdays) || weekdays.length === 0) return 1;
  let count = 0;
  for (
    let d = range.from.clone();
    !d.isAfter(range.to, "day");
    d = d.add(1, "day")
  ) {
    if (weekdays.includes(d.day())) count += 1;
  }
  return count;
}

export function spansMultipleDays(cfg) {
  return countScheduledDays(cfg) > 1;
}