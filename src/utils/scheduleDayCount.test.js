import { describe, it, expect } from "vitest";
import { countScheduledDays, spansMultipleDays } from "./scheduleDayCount";
import dayjs from "dayjs";

describe("countScheduledDays", () => {
  it("returns 1 for custom schedules", () => {
    expect(
      countScheduledDays({ isPreset: false, preset: "fullDay", startDate: dayjs(), weekdays: [0, 1, 2, 3, 4, 5, 6] }),
    ).toBe(1);
  });

  it("returns 1 for fullDay preset", () => {
    expect(
      countScheduledDays({ isPreset: true, preset: "fullDay", startDate: dayjs("2026-01-05"), weekdays: [0, 1, 2, 3, 4, 5, 6] }),
    ).toBe(1);
  });

  it("counts working days for fullWeek", () => {
    const start = dayjs("2026-01-05"); // Monday
    expect(
      countScheduledDays({ isPreset: true, preset: "fullWeek", startDate: start, weekdays: [0, 1, 2, 3, 4] }),
    ).toBe(5);
    expect(
      countScheduledDays({ isPreset: true, preset: "fullWeek", startDate: start, weekdays: [5, 6] }),
    ).toBe(2);
  });

  it("counts days for fullMonth", () => {
    const start = dayjs("2026-01-05");
    expect(
      countScheduledDays({ isPreset: true, preset: "fullMonth", startDate: start, weekdays: [0, 1, 2, 3, 4, 5, 6] }),
    ).toBe(27); // Jan 5..31
  });

  it("handles a single recurring weekday across a range", () => {
    const start = dayjs("2026-01-05"); // Monday
    const end = dayjs("2026-01-25");
    expect(
      countScheduledDays({ isPreset: true, preset: "specificDays", startDate: start, endDate: end, weekdays: [1] }),
    ).toBe(3); // 6, 13, 20 Jan
  });

  it("returns 1 when a month-end start leaves a single matching day", () => {
    const start = dayjs("2026-01-31"); // Saturday
    expect(
      countScheduledDays({ isPreset: true, preset: "fullMonth", startDate: start, weekdays: [6] }),
    ).toBe(1);
  });

  it("returns 1 when no weekdays selected", () => {
    const start = dayjs("2026-01-05");
    expect(
      countScheduledDays({ isPreset: true, preset: "specificDays", startDate: start, weekdays: [] }),
    ).toBe(1);
  });

  it("returns 1 when start date is missing/invalid", () => {
    expect(
      countScheduledDays({ isPreset: true, preset: "fullWeek", startDate: null, weekdays: [0, 1, 2, 3, 4] }),
    ).toBe(1);
  });
});

describe("spansMultipleDays", () => {
  it("true for fullWeek working days", () => {
    expect(
      spansMultipleDays({ isPreset: true, preset: "fullWeek", startDate: dayjs("2026-01-05"), weekdays: [0, 1, 2, 3, 4] }),
    ).toBe(true);
  });

  it("false for single day", () => {
    expect(
      spansMultipleDays({ isPreset: true, preset: "fullDay", startDate: dayjs("2026-01-05"), weekdays: [0, 1, 2, 3, 4] }),
    ).toBe(false);
  });
});

describe("working days only vs working days + weekends", () => {
  // Mirrors the day set the scheduling UI derives for the two radio options:
  //   working            → hostConfig.workingDays               e.g. [0,1,2,3,4]
  //   working+weekends   → union(workingDays, weekendDays)      e.g. [0,1,2,3,4,5,6]
  const WORKING = [0, 1, 2, 3, 4];
  const WEEKEND = [5, 6];
  const ALL = [...new Set([...WORKING, ...WEEKEND])];

  it("fullWeek with working days only counts 5", () => {
    const start = dayjs("2026-01-05"); // Monday
    expect(
      countScheduledDays({ isPreset: true, preset: "fullWeek", startDate: start, weekdays: WORKING }),
    ).toBe(5);
  });

  it("fullWeek with working days + weekends counts 7 (all days)", () => {
    const start = dayjs("2026-01-05"); // Monday
    expect(
      countScheduledDays({ isPreset: true, preset: "fullWeek", startDate: start, weekdays: ALL }),
    ).toBe(7);
  });

  it("fullMonth with working days only excludes weekends", () => {
    const start = dayjs("2026-01-05"); // Monday
    // Jan 5..31 = 27 calendar days; working only (Sun-Fri) drops Sat+Sun.
    expect(
      countScheduledDays({ isPreset: true, preset: "fullMonth", startDate: start, weekdays: WORKING }),
    ).toBeLessThan(
      countScheduledDays({ isPreset: true, preset: "fullMonth", startDate: start, weekdays: ALL }),
    );
  });

  it("fullMonth with working days + weekends covers every calendar day", () => {
    const start = dayjs("2026-01-05"); // Monday
    expect(
      countScheduledDays({ isPreset: true, preset: "fullMonth", startDate: start, weekdays: ALL }),
    ).toBe(27);
  });

  it("union is deduplicated (overlapping configs do not inflate the count)", () => {
    const start = dayjs("2026-01-05"); // Monday
    const overlapping = [...new Set([...WORKING, ...WORKING])];
    expect(
      countScheduledDays({ isPreset: true, preset: "fullWeek", startDate: start, weekdays: overlapping }),
    ).toBe(5);
  });

  it("weekend-only selection still works (legacy data)", () => {
    const start = dayjs("2026-01-05"); // Monday
    expect(
      countScheduledDays({ isPreset: true, preset: "fullWeek", startDate: start, weekdays: WEEKEND }),
    ).toBe(2);
  });
});