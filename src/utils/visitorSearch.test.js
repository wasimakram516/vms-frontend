import { describe, it, expect } from "vitest";
import { visitorMatchesQuery } from "./visitorSearch.js";

const visitor = {
  fullName: "Mohammed Ali",
  email: "mohd@example.com",
  phone: "91234567",
  idNo: "107499684",
  _idValue: "107499684",
};

describe("visitorMatchesQuery", () => {
  it("matches on full name", () => {
    expect(visitorMatchesQuery(visitor, "mohammed")).toBe(true);
  });

  it("matches on email", () => {
    expect(visitorMatchesQuery(visitor, "mohd@example")).toBe(true);
  });

  it("matches on phone", () => {
    expect(visitorMatchesQuery(visitor, "91234")).toBe(true);
  });

  it("matches on the ID card number", () => {
    expect(visitorMatchesQuery(visitor, "107499684")).toBe(true);
  });

  it("matches on the history-derived ID value when account idNo is absent", () => {
    expect(
      visitorMatchesQuery({ ...visitor, idNo: undefined }, "107499684"),
    ).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(visitorMatchesQuery(visitor, "MOHAMMED")).toBe(true);
    expect(visitorMatchesQuery(visitor, "107499684")).toBe(true);
  });

  it("returns true for an empty query", () => {
    expect(visitorMatchesQuery(visitor, "")).toBe(true);
    expect(visitorMatchesQuery(visitor, "   ")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(visitorMatchesQuery(visitor, "nope-nothing")).toBe(false);
  });

  it("matches a locally-stored phone with the country code when iso is known", () => {
    const v = { ...visitor, phone: "12345677", iso_code: "om" };
    expect(visitorMatchesQuery(v, "12345677")).toBe(true);
    expect(visitorMatchesQuery(v, "96812345677")).toBe(true);
    expect(visitorMatchesQuery(v, "+96812345677")).toBe(true);
  });

  it("matches a dial-qualified phone with the bare number", () => {
    const v = { ...visitor, phone: "+96812345677", iso_code: "om" };
    expect(visitorMatchesQuery(v, "12345677")).toBe(true);
    expect(visitorMatchesQuery(v, "96812345677")).toBe(true);
  });
});