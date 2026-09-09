import { describe, it, expect } from "vitest";
import { countPastVisits, resolvePastVisitBreakdown } from "./visitCount.js";

const past1 = { id: "past-1" };
const past2 = { id: "past-2" };
const current = { id: "current-0" };
const sibling = { id: "sibling-3" };

describe("countPastVisits", () => {
  it("excludes the registration currently being approved", () => {
    expect(countPastVisits([current, past1, past2], "current-0")).toBe(2);
  });

  it("returns 0 for a visitor with only the registration being approved", () => {
    expect(countPastVisits([current], "current-0")).toBe(0);
  });

  it("returns 0 when there are no registrations at all", () => {
    expect(countPastVisits([], "current-0")).toBe(0);
  });

  it("counts all registrations when none are being approved", () => {
    expect(countPastVisits([past1, past2])).toBe(2);
  });

  it("excludes every co-selected registration of the same visitor (batch)", () => {
    expect(countPastVisits([past1, current, sibling], ["current-0", "sibling-3"])).toBe(1);
  });

  it("accepts a Set of ids to exclude", () => {
    expect(countPastVisits([past1, current], new Set(["current-0"]))).toBe(1);
  });

  it("falls back to _id when id is undefined", () => {
    expect(countPastVisits([{ _id: "x-1" }, current], "current-0")).toBe(1);
  });

  it("prefers id over _id when both are present", () => {
    const dual = { id: "dual-1", _id: "dual-1" };
    expect(countPastVisits([dual, past1], "dual-1")).toBe(1);
  });

  it("treats an excluded id absent from the list as a no-op", () => {
    expect(countPastVisits([past1, past2], "ghost-id")).toBe(2);
  });

  it("returns 0 for a non-array", () => {
    expect(countPastVisits(undefined, "current-0")).toBe(0);
    expect(countPastVisits(null, "current-0")).toBe(0);
  });
});

describe("resolvePastVisitBreakdown", () => {
  const regsA = [
    { id: "cur", status: "pending" },
    { id: "a-visit-1", status: "visit_ended" },
    { id: "shared-group", status: "visit_ended" },
  ];
  const regsB = [
    { id: "cur", status: "pending" },
    { id: "b-visit-1", status: "visit_ended" },
    { id: "b-visit-2", status: "visit_ended" },
  ];
  const fetchRegistrations = async (_status, _range, userId) => {
    if (userId === "user-a") return regsA;
    if (userId === "user-b") return regsB;
    return [];
  };

  it("single visit: returns one entry, never counting the current registration", async () => {
    const res = await resolvePastVisitBreakdown(
      { id: "cur", user_id: "user-a", participants: [] },
      fetchRegistrations,
    );
    expect(res.isGroup).toBe(false);
    expect(res.breakdown).toHaveLength(1);
    expect(res.breakdown[0]).toEqual({ id: "user-a", fullName: "", count: 2 });
  });

  it("group meeting: returns one entry per participant with their own count", async () => {
    const res = await resolvePastVisitBreakdown(
      {
        id: "cur",
        participants: [
          { id: "user-a", fullName: "Alice" },
          { id: "user-b", fullName: "Bob" },
        ],
      },
      fetchRegistrations,
    );
    expect(res.isGroup).toBe(true);
    expect(res.breakdown).toEqual([
      { id: "user-a", fullName: "Alice", count: 2 },
      { id: "user-b", fullName: "Bob", count: 2 },
    ]);
  });

  it("group meeting: current registration is excluded from every member's count", async () => {
    const res = await resolvePastVisitBreakdown(
      {
        id: "cur",
        participants: [
          { id: "user-b", fullName: "Bob" },
          { id: "user-x", fullName: "X" },
        ],
      },
      fetchRegistrations,
    );
    const bob = res.breakdown.find((m) => m.id === "user-b");
    expect(bob.count).toBe(2);
  });

  it("group meeting: a member with no history reports 0 (New)", async () => {
    const res = await resolvePastVisitBreakdown(
      {
        id: "cur",
        participants: [
          { id: "user-x", fullName: "Newcomer" },
          { id: "user-a", fullName: "Alice" },
        ],
      },
      fetchRegistrations,
    );
    const newcomer = res.breakdown.find((m) => m.id === "user-x");
    expect(newcomer.count).toBe(0);
  });

  it("returns an empty breakdown when there is no target", async () => {
    const res = await resolvePastVisitBreakdown(null, fetchRegistrations);
    expect(res).toEqual({ isGroup: false, breakdown: [] });
  });

  it("returns an empty breakdown for a single visit without an owner id", async () => {
    const res = await resolvePastVisitBreakdown(
      { id: "cur", participants: [] },
      fetchRegistrations,
    );
    expect(res).toEqual({ isGroup: false, breakdown: [] });
  });

  it("swallows fetch failures and reports 0 for that member", async () => {
    const failingFetch = async () => {
      throw new Error("boom");
    };
    const res = await resolvePastVisitBreakdown(
      {
        id: "cur",
        participants: [
          { id: "user-a", fullName: "Alice" },
          { id: "user-b", fullName: "Bob" },
        ],
      },
      failingFetch,
    );
    expect(res.breakdown).toEqual([
      { id: "user-a", fullName: "Alice", count: 0 },
      { id: "user-b", fullName: "Bob", count: 0 },
    ]);
  });
});