import { beforeEach, describe, expect, it, vi } from "vitest";

describe("authStorage", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("keeps access tokens and user profiles in memory only", async () => {
    const storage = await import("./authStorage");

    storage.setStoredAuthData("access-token", { id: "user-1" });

    expect(storage.getStoredToken()).toBe("access-token");
    expect(storage.getStoredUser()).toEqual({ id: "user-1" });
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("removes legacy persisted authentication data on module load", async () => {
    localStorage.setItem("accessToken", "legacy-token");
    localStorage.setItem("user", JSON.stringify({ id: "legacy-user" }));

    const storage = await import("./authStorage");

    expect(storage.getStoredToken()).toBeNull();
    expect(storage.getStoredUser()).toBeNull();
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("coalesces concurrent refresh attempts", async () => {
    const storage = await import("./authStorage");
    const refresh = vi.fn(async () => "new-token");

    const [first, second] = await Promise.all([
      storage.runSingleRefresh(refresh),
      storage.runSingleRefresh(refresh),
    ]);

    expect(first).toBe("new-token");
    expect(second).toBe("new-token");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
