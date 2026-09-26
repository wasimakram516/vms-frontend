import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActivityDetailsDialog from "./ActivityDetailsDialog";

vi.mock("@/utils/iconUtil", () => ({
  default: new Proxy({}, { get: () => () => null }),
}));

vi.mock("@/utils/activityMeta", () => ({
  getActivityDisplayLabel: (type, metadata) =>
    type === "login" && metadata?.result === "failed"
      ? "Failed Login"
      : "Login",
}));

const mockUseAuth = vi.fn(() => undefined);
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockRevokeUserSessions = vi.fn().mockResolvedValue({});
vi.mock("@/services/authService", () => ({
  revokeUserSessions: (...args) => mockRevokeUserSessions(...args),
}));

const successfulLogin = {
  activityType: "login",
  actorUserId: "admin-1",
  actorName: "Security Admin",
  metadata: { result: "success" },
};

describe("ActivityDetailsDialog", () => {
  it("shows reviewed login metadata without rendering unknown fields", () => {
    render(
      <ActivityDetailsDialog
        open
        onClose={vi.fn()}
        activity={{
          activityType: "login",
          visitorName: "Security Admin",
          actorName: "Security Admin",
          createdAt: "2026-09-25T17:35:00.000Z",
          notes: "Account logged in",
          metadata: {
            result: "success",
            accountRole: "admin",
            ipAddress: "203.0.113.10",
            userAgent:
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
              "Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0",
            requestId: "request-1",
            refreshToken: "must-not-render",
          },
        }}
      />,
    );

    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getAllByText("Security Admin")).toHaveLength(2);
    expect(screen.getByText("203.0.113.10")).toBeInTheDocument();
    expect(screen.getByText("Microsoft Edge 153.0.0.0")).toBeInTheDocument();
    expect(screen.getByText("Windows 10 or 11")).toBeInTheDocument();
    expect(screen.getByText("Desktop")).toBeInTheDocument();
    expect(screen.getByText("request-1")).toBeInTheDocument();
    expect(screen.queryByText("must-not-render")).not.toBeInTheDocument();
  });

  it("is keyboard-accessible through its close action", () => {
    const onClose = vi.fn();
    render(
      <ActivityDetailsDialog
        open
        onClose={onClose}
        activity={{ activityType: "logout", metadata: {} }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the exact localhost IP and identifies its non-geographic location", () => {
    render(
      <ActivityDetailsDialog
        open
        onClose={vi.fn()}
        activity={{
          activityType: "login",
          metadata: { ipAddress: "::1", result: "success" },
        }}
      />,
    );

    expect(screen.getByText("::1 (IPv6 localhost)")).toBeInTheDocument();
    expect(screen.getByText("Local machine")).toBeInTheDocument();
  });
});

describe("ActivityDetailsDialog — revoke session from a login event", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockRevokeUserSessions.mockClear();
  });

  it("offers Revoke Session to a SuperAdmin viewing someone else's login", () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-2", role: "superadmin" } });
    render(
      <ActivityDetailsDialog open onClose={vi.fn()} activity={successfulLogin} />,
    );

    expect(
      screen.getByRole("button", { name: "Revoke Session" }),
    ).toBeInTheDocument();
  });

  it("hides the action for a non-SuperAdmin viewer", () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-2", role: "admin" } });
    render(
      <ActivityDetailsDialog open onClose={vi.fn()} activity={successfulLogin} />,
    );

    expect(
      screen.queryByRole("button", { name: "Revoke Session" }),
    ).not.toBeInTheDocument();
  });

  it("hides the action when viewing your own login", () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-1", role: "superadmin" } });
    render(
      <ActivityDetailsDialog open onClose={vi.fn()} activity={successfulLogin} />,
    );

    expect(
      screen.queryByRole("button", { name: "Revoke Session" }),
    ).not.toBeInTheDocument();
  });

  it("hides the action for a failed login attempt or a logout entry", () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-2", role: "superadmin" } });
    const { rerender } = render(
      <ActivityDetailsDialog
        open
        onClose={vi.fn()}
        activity={{ ...successfulLogin, metadata: { result: "failed" } }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Revoke Session" }),
    ).not.toBeInTheDocument();

    rerender(
      <ActivityDetailsDialog
        open
        onClose={vi.fn()}
        activity={{ ...successfulLogin, activityType: "logout" }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Revoke Session" }),
    ).not.toBeInTheDocument();
  });

  it("revokes the account's sessions and closes the dialog on success", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-2", role: "superadmin" } });
    const onClose = vi.fn();
    render(
      <ActivityDetailsDialog open onClose={onClose} activity={successfulLogin} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Revoke Session" }));

    const confirmButtons = await screen.findAllByRole("button", {
      name: "Revoke Session",
    });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await vi.waitFor(() =>
      expect(mockRevokeUserSessions).toHaveBeenCalledWith("admin-1"),
    );
    // There's nothing further to review on this historical login once the
    // account has been revoked — the Activity Logs list gets the new
    // "Session Revoked" record on its own via the real-time socket listener.
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("keeps the dialog open so the SuperAdmin can retry after a failed revoke", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-2", role: "superadmin" } });
    mockRevokeUserSessions.mockResolvedValueOnce({ error: true, message: "Network error" });
    const onClose = vi.fn();
    render(
      <ActivityDetailsDialog open onClose={onClose} activity={successfulLogin} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Revoke Session" }));
    const confirmButtons = await screen.findAllByRole("button", {
      name: "Revoke Session",
    });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await vi.waitFor(() =>
      expect(mockRevokeUserSessions).toHaveBeenCalledWith("admin-1"),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not crash when rendered with no auth context available", () => {
    mockUseAuth.mockReturnValue(undefined);
    expect(() =>
      render(
        <ActivityDetailsDialog open onClose={vi.fn()} activity={successfulLogin} />,
      ),
    ).not.toThrow();
    expect(
      screen.queryByRole("button", { name: "Revoke Session" }),
    ).not.toBeInTheDocument();
  });
});

describe("ActivityDetailsDialog — a session_revoked entry", () => {
  beforeEach(() => mockUseAuth.mockReturnValue(undefined));

  it("shows who revoked it, the scope, and the session count", () => {
    render(
      <ActivityDetailsDialog
        open
        onClose={vi.fn()}
        activity={{
          activityType: "session_revoked",
          visitorName: "Gate Staff",
          actorName: "Gate Staff",
          notes: "Super Admin revoked Gate Staff's session",
          metadata: {
            subjectRole: "staff",
            performedByName: "Super Admin",
            scope: "user",
            revokedSessionCount: 2,
          },
        }}
      />,
    );

    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByText("Single account")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
