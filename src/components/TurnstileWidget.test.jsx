import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({
  default: ({ onLoad }) => (
    <button type="button" data-testid="turnstile-script" onClick={onLoad} />
  ),
}));

describe("TurnstileWidget", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.resetModules();
    delete window.turnstile;
  });

  it("returns tokens and resets the single-use widget after an attempt", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
    const renderTurnstile = vi.fn().mockReturnValue("widget-1");
    const resetTurnstile = vi.fn();
    const removeTurnstile = vi.fn();
    window.turnstile = {
      render: renderTurnstile,
      reset: resetTurnstile,
      remove: removeTurnstile,
    };
    const onTokenChange = vi.fn();
    const { default: TurnstileWidget } = await import("./TurnstileWidget");
    const view = render(
      <TurnstileWidget
        action="otp-send"
        onTokenChange={onTokenChange}
        resetKey={0}
      />,
    );

    expect(screen.getByLabelText("Bot verification")).toBeInTheDocument();
    expect(renderTurnstile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sitekey: "test-site-key",
        action: "otp-send",
      }),
    );
    renderTurnstile.mock.calls[0][1].callback("verified-token");
    expect(onTokenChange).toHaveBeenCalledWith("verified-token");

    view.rerender(
      <TurnstileWidget
        action="otp-send"
        onTokenChange={onTokenChange}
        resetKey={1}
      />,
    );
    expect(resetTurnstile).toHaveBeenCalledWith("widget-1");

    view.unmount();
    expect(removeTurnstile).toHaveBeenCalledWith("widget-1");
    // 30s: this test forces a fresh module import via vi.resetModules() (to
    // pick up the stubbed env var) on every run, which is slow enough under a
    // fully parallel CI worker load that 15s intermittently wasn't enough.
  }, 30_000);
});
