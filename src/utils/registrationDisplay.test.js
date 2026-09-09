import { describe, it, expect } from "vitest";
import {
  getGroupMemberNames,
  getStoredMeetingName,
  getRegistrationDisplayName,
  getRegistrationDisplayInitial,
} from "./registrationDisplay.js";

const groupReg = {
  userId: null,
  full_name: "N/A",
  participants: [
    { id: "u1", fullName: "Alice Walker" },
    { id: "u2", fullName: "Bob Jones" },
  ],
};

const singleReg = {
  full_name: "Charlie Brown",
  user: { fullName: "Charlie Brown" },
};

describe("getGroupMemberNames", () => {
  it("returns participant full names for a group registration", () => {
    expect(getGroupMemberNames(groupReg)).toEqual([
      "Alice Walker",
      "Bob Jones",
    ]);
  });

  it("returns an empty array for single visits", () => {
    expect(getGroupMemberNames(singleReg)).toEqual([]);
  });
});

describe("getStoredMeetingName", () => {
  it("returns a trimmed meeting name when present", () => {
    expect(getStoredMeetingName({ meetingName: "  Board Review  " })).toBe(
      "Board Review",
    );
  });

  it("supports the snake_case alias", () => {
    expect(getStoredMeetingName({ meeting_name: "Audit Sync" })).toBe(
      "Audit Sync",
    );
  });

  it("returns null when empty, whitespace, or missing", () => {
    expect(getStoredMeetingName({ meetingName: "" })).toBeNull();
    expect(getStoredMeetingName({ meetingName: "   " })).toBeNull();
    expect(getStoredMeetingName({})).toBeNull();
  });
});

describe("getRegistrationDisplayName", () => {
  it("prefers the stored meeting name for group meetings", () => {
    expect(
      getRegistrationDisplayName({ ...groupReg, meetingName: "Board Review" }),
    ).toBe("Board Review");
  });

  it("falls back to member names when no meeting name is stored", () => {
    expect(getRegistrationDisplayName(groupReg)).toBe(
      "Group Meeting (Alice Walker, Bob Jones)",
    );
  });

  it("falls back to the fallback label for name-less single visits", () => {
    expect(getRegistrationDisplayName({ userId: "u1" }, "Visitor")).toBe(
      "Visitor",
    );
  });

  it("returns the visitor name for a single visit", () => {
    expect(getRegistrationDisplayName(singleReg)).toBe("Charlie Brown");
  });
});

describe("getRegistrationDisplayInitial", () => {
  it("uses the first member's initial for group meetings", () => {
    expect(getRegistrationDisplayInitial(groupReg)).toBe("A");
  });

  it("uses the visitor initial for single visits", () => {
    expect(getRegistrationDisplayInitial(singleReg)).toBe("C");
  });
});