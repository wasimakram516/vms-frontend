import { describe, it, expect } from "vitest";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

import {
  PREMISE_TZ,
  userTimeZone,
  workingHoursToUserLocal,
} from "./premiseTime";

describe("workingHoursToUserLocal", () => {
  it("is identity when the user is on the premise timezone (Asia/Muscat)", () => {
    expect(
      workingHoursToUserLocal(
        { startH: 8, startM: 0, endH: 17, endM: 0 },
        PREMISE_TZ,
      ),
    ).toEqual({ startH: 8, startM: 0, endH: 17, endM: 0 });
  });

  it("converts an Oman window into a Karachi user's local window (+1h)", () => {
    expect(
      workingHoursToUserLocal(
        { startH: 8, startM: 0, endH: 17, endM: 0 },
        "Asia/Karachi",
      ),
    ).toEqual({ startH: 9, startM: 0, endH: 18, endM: 0 });
  });

  it("keeps minutes intact and handles non-zero minutes", () => {
    expect(
      workingHoursToUserLocal(
        { startH: 8, startM: 30, endH: 16, endM: 45 },
        "Asia/Karachi",
      ),
    ).toEqual({ startH: 9, startM: 30, endH: 17, endM: 45 });
  });

  it("always produces the same premise instant regardless of the viewer's device zone", () => {
    const premiseStartH = 8;
    // Deterministic check: user local rendered back into premise time.
    const karachi = workingHoursToUserLocal(
      { startH: premiseStartH, startM: 0, endH: 17, endM: 0 },
      "Asia/Karachi",
    );
    const today = dayjs().format("YYYY-MM-DD");
    const instant = dayjs
      .tz(`${today} ${String(karachi.startH).padStart(2, "0")}:${String(karachi.startM).padStart(2, "0")}`, "Asia/Karachi")
      .tz(PREMISE_TZ);
    expect(instant.hour()).toBe(premiseStartH);
    expect(instant.minute()).toBe(0);
  });
});

describe("userTimeZone", () => {
  it("returns a non-empty IANA name", () => {
    expect(typeof userTimeZone()).toBe("string");
    expect(userTimeZone().length).toBeGreaterThan(0);
  });
});