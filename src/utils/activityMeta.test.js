import { describe, expect, it, vi } from "vitest";
import {
  ACTIVITY_TYPES,
  getActivityDisplayLabel,
  getActivityLabel,
  getActivityStatus,
} from "./activityMeta";

vi.mock("@/utils/iconUtil", () => ({
  default: new Proxy({}, { get: () => () => null }),
}));

describe("authentication activity metadata", () => {
  it("marks rejected logins as failed security events", () => {
    const metadata = { result: "failed" };

    expect(getActivityDisplayLabel("login", metadata)).toBe("Failed Login");
    expect(getActivityStatus("login", metadata)).toBe("error");
  });

  it("marks successful logins as successful", () => {
    const metadata = { result: "success" };

    expect(getActivityDisplayLabel("login", metadata)).toBe("Login");
    expect(getActivityStatus("login", metadata)).toBe("success");
  });
});

describe("session-revocation activity metadata", () => {
  it("is a filterable activity type with a readable, non-error label", () => {
    expect(ACTIVITY_TYPES).toContain("session_revoked");
    expect(getActivityLabel("session_revoked")).toBe("Session Revoked");
    expect(getActivityStatus("session_revoked")).toBe("warning");
  });
});
