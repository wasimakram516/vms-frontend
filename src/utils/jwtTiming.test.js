import { describe, expect, it } from "vitest";
import { shouldRefreshAccessToken } from "./jwtTiming";

/** Create an unsigned JWT-shaped value for deterministic timing tests. */
function createToken(iat, exp) {
  const payload = btoa(JSON.stringify({ iat, exp }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `header.${payload}.signature`;
}

describe("shouldRefreshAccessToken", () => {
  it("does not immediately refresh a newly issued one-minute token", () => {
    const token = createToken(1_000, 1_060);

    expect(shouldRefreshAccessToken(token, 1_001_000)).toBe(false);
  });

  it("refreshes a one-minute token during its final twenty percent", () => {
    const token = createToken(1_000, 1_060);

    expect(shouldRefreshAccessToken(token, 1_050_000)).toBe(true);
  });

  it("caps the refresh window for normal fifteen-minute tokens at two minutes", () => {
    const token = createToken(1_000, 1_900);

    expect(shouldRefreshAccessToken(token, 1_779_000)).toBe(false);
    expect(shouldRefreshAccessToken(token, 1_781_000)).toBe(true);
  });

  it("ignores malformed tokens", () => {
    expect(shouldRefreshAccessToken("not-a-jwt", 1_000)).toBe(false);
  });
});
