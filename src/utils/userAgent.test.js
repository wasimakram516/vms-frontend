import { describe, expect, it } from "vitest";
import { parseUserAgent } from "./userAgent";

describe("parseUserAgent", () => {
  it("formats an Edge desktop user agent", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0",
    );

    expect(result).toEqual({
      browser: "Microsoft Edge 153.0.0.0",
      operatingSystem: "Windows 10 or 11",
      device: "Desktop",
    });
  });

  it("returns explicit unknown values when no user agent was captured", () => {
    expect(parseUserAgent(null)).toEqual({
      browser: "Unknown",
      operatingSystem: "Unknown",
      device: "Unknown",
    });
  });
});
