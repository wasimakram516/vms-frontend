import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActivityDetailsDialog from "./ActivityDetailsDialog";

vi.mock("@/utils/iconUtil", () => ({
  default: { history: () => null, close: () => null },
}));

vi.mock("@/utils/activityMeta", () => ({
  getActivityDisplayLabel: (type, metadata) =>
    type === "login" && metadata?.result === "failed"
      ? "Failed Login"
      : "Login",
}));

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
