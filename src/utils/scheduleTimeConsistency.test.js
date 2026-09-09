import { describe, it, expect } from "vitest";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

import { rollOvernightEnd, PREMISE_TZ } from "./premiseTime";

const TZS = [PREMISE_TZ, "Asia/Karachi"]; // Oman +4, Pakistan +5

const pad2 = (n) => String(n).padStart(2, "0");
// wallToUtc: typed wall time ("YYYY-MM-DD", "HH:mm") in a tz → UTC ISO.
const wallToUtc = (date, time, tz) =>
  dayjs.tz(`${date} ${time}`, tz).utc().toISOString();
// utcToWall: utc ISO → wall "HH:mm" in a tz.
const utcToWall = (iso, tz) =>
  dayjs(iso).tz(tz).format("HH:mm");
const utcToDate = (iso, tz) => dayjs(iso).tz(tz).format("YYYY-MM-DD");

// Mirrors backend updateStatus check-in window check:
// inside = within [from - buffer, to (+ buffer unless recheck-in)].
function checkinInside(approvedFrom, approvedTo, checkinAt, bufferMins = 60, recheckin = false) {
  const fromMs = new Date(approvedFrom).getTime() - bufferMins * 60_000;
  const toMs = new Date(approvedTo).getTime() + (recheckin ? 0 : bufferMins * 60_000);
  const at = new Date(checkinAt).getTime();
  return at >= fromMs && at <= toMs;
}

describe("rollOvernightEnd — all authoring combos (custom)", () => {
  it("rolls the end to the next day when end time < start time (same day)", () => {
    expect(
      rollOvernightEnd({ fromDate: "2026-09-08", toDate: "2026-09-08", fromTime: "11:00", toTime: "01:30", isPreset: false }),
    ).toBe("2026-09-09");
    expect(
      rollOvernightEnd({ fromDate: "2026-09-08", toDate: "2026-09-08", fromTime: "23:00", toTime: "23:30", isPreset: false }),
    ).toBe("2026-09-08"); // 23h -> 23:30 still later same day? no, 23:30 > 23:00 → same day
    expect(
      rollOvernightEnd({ fromDate: "2026-09-08", toDate: "2026-09-08", fromTime: "23:00", toTime: "01:30", isPreset: false }),
    ).toBe("2026-09-09");
    expect(
      rollOvernightEnd({ fromDate: "2026-09-08", toDate: "2026-09-08", fromTime: "00:00", toTime: "00:00", isPreset: false }),
    ).toBe("2026-09-08"); // equal → not inverted
  });

  it("never touches multi-day or preset windows", () => {
    expect(
      rollOvernightEnd({ fromDate: "2026-09-08", toDate: "2026-09-14", fromTime: "23:00", toTime: "01:30", isPreset: false }),
    ).toBe("2026-09-14");
    expect(
      rollOvernightEnd({ fromDate: "2026-09-08", toDate: "2026-09-08", fromTime: "23:00", toTime: "01:30", isPreset: true }),
    ).toBe("2026-09-08");
  });
});

describe("round-trip consistency: typed wall → UTC → same wall (per timezone)", () => {
  const combo = [
    ["2026-09-08", "11:00"],
    ["2026-09-08", "01:30"],
    ["2026-09-08", "23:59"],
    ["2026-09-30", "00:00"], // month-end
    ["2026-11-30", "16:45"],
  ];
  for (const tz of TZS) {
    for (const [date, time] of combo) {
      it(`${tz} ${date} ${time} is exact after UTC round-trip`, () => {
        const iso = wallToUtc(date, time, tz);
        expect(utcToDate(iso, tz)).toBe(date);
        expect(utcToWall(iso, tz)).toBe(time);
      });
    }
  }

  it("two timezones store the same wall intent as different, offset-exact UTC instants", () => {
    const mus = dayjs(wallToUtc("2026-09-08", "11:00", PREMISE_TZ)).valueOf();
    const kar = dayjs(wallToUtc("2026-09-08", "11:00", "Asia/Karachi")).valueOf();
    // 11:00 Karachi (+5) = 06:00Z; 11:00 Oman (+4) = 07:00Z → Oman is exactly 1h later in UTC.
    expect(mus - kar).toBe(60 * 60 * 1000);
  });
});

describe("check-in window consistency — all presets × both timezones", () => {
  for (const tz of TZS) {
    describe(`tz=${tz}`, () => {
      it("fullDay: same-day working-hours window (8:00–17:00) gates check-in correctly", () => {
        const from = wallToUtc("2026-09-08", "08:00", tz);
        const to = wallToUtc("2026-09-08", "17:00", tz);
        expect(checkinInside(from, to, wallToUtc("2026-09-08", "08:00", tz), 0)).toBe(true);
        expect(checkinInside(from, to, wallToUtc("2026-09-08", "16:59", tz), 0)).toBe(true);
        expect(checkinInside(from, to, wallToUtc("2026-09-08", "17:01", tz), 0)).toBe(false);
        expect(checkinInside(from, to, wallToUtc("2026-09-08", "07:59", tz), 0)).toBe(false);
        // 60-min buffer widens both ends
        expect(checkinInside(from, to, wallToUtc("2026-09-08", "07:15", tz))).toBe(true);
        expect(checkinInside(from, to, wallToUtc("2026-09-08", "17:45", tz))).toBe(true);
      });

      it("fullWeek: 6-day range honors daily time (09:30–17:15)", () => {
        const from = wallToUtc("2026-09-07", "09:30", tz);
        const to = wallToUtc("2026-09-13", "17:15", tz);
        expect(rollOvernightEnd({ fromDate: "2026-09-07", toDate: "2026-09-13", fromTime: "09:30", toTime: "17:15", isPreset: true })).toBe("2026-09-13");
        expect(checkinInside(from, to, wallToUtc("2026-09-07", "10:00", tz), 0)).toBe(true);
        expect(checkinInside(from, to, wallToUtc("2026-09-10", "12:00", tz), 0)).toBe(true);
        expect(checkinInside(from, to, wallToUtc("2026-09-13", "17:15", tz), 0)).toBe(true);
        expect(checkinInside(from, to, wallToUtc("2026-09-13", "17:16", tz), 0)).toBe(false);
        expect(checkinInside(from, to, wallToUtc("2026-09-06", "23:00", tz), 0)).toBe(false);
      });

      it("fullMonth: month-end window (11:00 → next-month-early cannot exist; daily 11:00–23:00)", () => {
        const from = wallToUtc("2026-09-01", "11:00", tz);
        const to = wallToUtc("2026-09-30", "23:00", tz);
        expect(checkinInside(from, to, wallToUtc("2026-09-15", "12:00", tz), 0)).toBe(true);
        expect(checkinInside(from, to, wallToUtc("2026-09-30", "22:59", tz), 0)).toBe(true);
        expect(checkinInside(from, to, wallToUtc("2026-10-01", "00:00", tz), 0)).toBe(false);
      });

      it("specificDays: start→end range with per-day time (08:30–20:00)", () => {
        const from = wallToUtc("2026-09-08", "08:30", tz);
        const to = wallToUtc("2026-09-12", "20:00", tz);
        expect(checkinInside(from, to, wallToUtc("2026-09-12", "19:59", tz), 0)).toBe(true);
        expect(checkinInside(from, to, wallToUtc("2026-09-12", "20:01", tz), 0)).toBe(false);
        expect(checkinInside(from, to, wallToUtc("2026-09-09", "09:00", tz), 0)).toBe(true);
      });

      it("custom overnight: '11:00 PM → 1:30 AM' rolls to next day and gates correctly", () => {
        const toDate = rollOvernightEnd({ fromDate: "2026-09-08", toDate: "2026-09-08", fromTime: "23:00", toTime: "01:30", isPreset: false });
        expect(toDate).toBe("2026-09-09");
        const from = wallToUtc("2026-09-08", "23:00", tz);
        const to = wallToUtc("2026-09-09", "01:30", tz);
        expect(checkinInside(from, to, wallToUtc("2026-09-08", "23:15", tz), 0)).toBe(true);
        expect(checkinInside(from, to, wallToUtc("2026-09-09", "01:29", tz), 0)).toBe(true);
        expect(checkinInside(from, to, wallToUtc("2026-09-09", "01:31", tz), 0)).toBe(false);
        expect(checkinInside(from, to, wallToUtc("2026-09-08", "22:59", tz), 0)).toBe(false);
      });

      it("custom non-overnight: '11:00 AM → 1:30 PM' stays same day", () => {
        const toDate = rollOvernightEnd({ fromDate: "2026-09-08", toDate: "2026-09-08", fromTime: "11:00", toTime: "13:30", isPreset: false });
        expect(toDate).toBe("2026-09-08");
        const from = wallToUtc("2026-09-08", "11:00", tz);
        const to = wallToUtc("2026-09-08", "13:30", tz);
        expect(checkinInside(from, to, wallToUtc("2026-09-08", "11:15", tz), 0)).toBe(true); // the ORIGINAL bug scenario → passes
        expect(checkinInside(from, to, wallToUtc("2026-09-08", "20:00", tz), 0)).toBe(false);
      });

      it("never produces inverted windows — end instant is always after start instant", () => {
        const cases = [
          { d: "2026-09-08", f: "23:00", t: "01:30" },
          { d: "2026-09-08", f: "11:00", t: "01:30" },
          { d: "2026-09-08", f: "00:00", t: "00:00" },
          { d: "2026-09-08", f: "00:01", t: "11:59" },
        ];
        for (const c of cases) {
          const td = rollOvernightEnd({ fromDate: c.d, toDate: c.d, fromTime: c.f, toTime: c.t, isPreset: false });
          const from = dayjs(wallToUtc(c.d, c.f, tz)).valueOf();
          const to = dayjs(wallToUtc(td, c.t, tz)).valueOf();
          expect(to >= from).toBe(true);
        }
      });
    });
  }
});

// Cross-timezone sanity: the SAME wall intent in Oman vs Karachi yields the same
// "is check-in inside?" answer when staff compare in their own local times.
describe("cross-timezone consistency (Karachi dev vs Oman operator)", () => {
  it("Karachi 8:15 local is outside an 8–12 Oman window — correctly detected in BOTH tzs", () => {
    const fromOman = wallToUtc("2026-09-08", "08:00", PREMISE_TZ);
    const toOman = wallToUtc("2026-09-08", "12:00", PREMISE_TZ);
    // A Karachi operator sees the window as 9–13 local and types 8:15 local (=7:15 Oman → outside)
    const karachiTyped = wallToUtc("2026-09-08", "08:15", "Asia/Karachi");
    expect(checkinInside(fromOman, toOman, karachiTyped, 0)).toBe(false); // 8:15 PK = 7:15 Oman → before window
    // An Oman operator types 8:15 local (=8:15 Oman → inside)
    const omanTyped = wallToUtc("2026-09-08", "08:15", PREMISE_TZ);
    expect(checkinInside(fromOman, toOman, omanTyped, 0)).toBe(true);
    // And the Karachi user's DISPLAY of the Oman window is 9–13 — the stored window is unchanged
    expect(utcToWall(fromOman, "Asia/Karachi")).toBe("09:00");
    expect(utcToWall(toOman, "Asia/Karachi")).toBe("13:00");
  });

  it("the overnight-rolled custom window gives an inside result for both tzs at their own 11:15 PM", () => {
    for (const tz of TZS) {
      const toDate = rollOvernightEnd({ fromDate: "2026-09-08", toDate: "2026-09-08", fromTime: "23:00", toTime: "01:30", isPreset: false });
      const from = wallToUtc("2026-09-08", "23:00", tz);
      const to = wallToUtc(toDate, "01:30", tz);
      expect(checkinInside(from, to, wallToUtc("2026-09-08", "23:15", tz), 0)).toBe(true);
    }
  });
});