import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("CSP report endpoint", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs only sanitized CSP fields", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const request = new Request("https://sentry.sinan.om/api/csp-report", {
      method: "POST",
      body: JSON.stringify({
        "csp-report": {
          "document-uri": "https://sentry.sinan.om/cms?token=secret",
          "blocked-uri": "https://evil.example/collect?visitor=secret",
          "effective-directive": "script-src-elem",
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledWith(
      "csp_violation",
      expect.objectContaining({
        documentUri: "https://sentry.sinan.om/cms",
        blockedUri: "https://evil.example/collect",
        effectiveDirective: "script-src-elem",
      }),
    );
  });

  it("rejects malformed reports", async () => {
    const request = new Request("https://sentry.sinan.om/api/csp-report", {
      method: "POST",
      body: "not-json",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
