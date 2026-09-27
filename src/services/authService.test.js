import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPost = vi.fn();
vi.mock("./api", () => ({
  default: { post: (...args) => mockPost(...args), get: vi.fn() },
}));

const mockShowGlobalMessage = vi.fn();
vi.mock("@/contexts/MessageContext", () => ({
  showGlobalMessage: (...args) => mockShowGlobalMessage(...args),
}));

vi.mock("@/utils/authStorage", () => ({
  setStoredAuthData: vi.fn(),
  getStoredUser: vi.fn(),
  getStoredToken: vi.fn(),
  clearStoredAuthData: vi.fn(),
  runSingleRefresh: (fn) => fn(),
}));

const { revokeUserSessions } = await import("./authService");

describe("revokeUserSessions", () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockShowGlobalMessage.mockReset();
  });

  it("reports an accurate outcome when a live session was actually ended", async () => {
    mockPost.mockResolvedValue({
      data: { success: true, data: { revokedSessionCount: 2 } },
    });

    const result = await revokeUserSessions("user-1");

    expect(result).toEqual({ revokedSessionCount: 2 });
    expect(mockShowGlobalMessage).toHaveBeenCalledWith(
      "Session revoked — 2 active sessions ended.",
      "success",
    );
  });

  it("does not claim a session was revoked when the account had none", async () => {
    // Revoking an account with no active session (or revoking the same one
    // twice) is a real path an admin can reach from the Users page or a
    // historical login's Activity Details dialog — the backend intentionally
    // treats it as a no-op and skips the audit log entry, so the toast must
    // not say "Session revoked" for something that didn't happen.
    mockPost.mockResolvedValue({
      data: { success: true, data: { revokedSessionCount: 0 } },
    });

    const result = await revokeUserSessions("user-1");

    expect(result).toEqual({ revokedSessionCount: 0 });
    expect(mockShowGlobalMessage).toHaveBeenCalledWith(
      "No active session found for this account — nothing to revoke.",
      "info",
    );
  });

  it("uses singular wording for exactly one ended session", async () => {
    mockPost.mockResolvedValue({
      data: { success: true, data: { revokedSessionCount: 1 } },
    });

    await revokeUserSessions("user-1");

    expect(mockShowGlobalMessage).toHaveBeenCalledWith(
      "Session revoked — 1 active session ended.",
      "success",
    );
  });
});
