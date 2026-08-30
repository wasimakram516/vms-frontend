import { describe, it, expect } from "vitest";
import { phoneMatchesQuery, getPhoneDigits } from "./countryCodes.js";

describe("phoneMatchesQuery — country-code aware", () => {
  it("strips formatting from stored numbers", () => {
    expect(getPhoneDigits("(+968)12345677")).toBe("96812345677");
  });

  it("matches a locally-stored number with any dial form when iso is known", () => {
    // stored local 12345677, iso om (+968)
    expect(phoneMatchesQuery("12345677", "12345677", "om")).toBe(true);
    expect(phoneMatchesQuery("12345677", "96812345677", "om")).toBe(true);
    expect(phoneMatchesQuery("12345677", "+96812345677", "om")).toBe(true);
  });

  it("matches a dial-stored number with any form", () => {
    expect(phoneMatchesQuery("(+968)12345677", "96812345677", "om")).toBe(true);
    expect(phoneMatchesQuery("(+968)12345677", "+96812345677", "om")).toBe(true);
    expect(phoneMatchesQuery("(+968)12345677", "12345677", "om")).toBe(true);
    expect(phoneMatchesQuery("+96891234567", "91234567", "om")).toBe(true);
  });

  it("supports any country dial code", () => {
    expect(phoneMatchesQuery("51234567", "+97151234567", "ae")).toBe(true); // UAE +971
    expect(phoneMatchesQuery("4254801234", "+14254801234", "us")).toBe(true); // US +1
  });

  it("returns true for an empty query and false for a non-match", () => {
    expect(phoneMatchesQuery("12345677", "", "om")).toBe(true);
    expect(phoneMatchesQuery("12345677", "999999", "om")).toBe(false);
  });
});
