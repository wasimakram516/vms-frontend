import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./contentSecurityPolicy";

describe("buildContentSecurityPolicy", () => {
  it("allows only configured API, socket, and media origins", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "test-nonce",
      isDevelopment: false,
      apiUrl: "https://api.sentry.sinan.om/api/v1",
      websocketUrl: "wss://api.sentry.sinan.om/socket.io",
      mediaOrigins:
        "https://media.sinan.om, javascript:alert(1), https://media.sinan.om/assets",
    });

    expect(policy).toContain(
      "script-src 'self' 'nonce-test-nonce' 'strict-dynamic'",
    );
    expect(policy).toContain("connect-src 'self' https://api.sentry.sinan.om");
    expect(policy).toContain("https://challenges.cloudflare.com");
    expect(policy).toContain(
      "frame-src https://challenges.cloudflare.com",
    );
    expect(policy).toContain("wss://api.sentry.sinan.om");
    expect(policy).toContain("https://media.sinan.om");
    expect(policy).not.toContain("javascript:");
    expect(policy.match(/https:\/\/media\.sinan\.om/g)).toHaveLength(2);
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("report-uri /api/csp-report");
    expect(policy).toContain("report-to csp-endpoint");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("allows the ws(s) transport for an http(s)-scheme websocket host", () => {
    // NEXT_PUBLIC_WEBSOCKET_HOST is conventionally http(s) (it's what
    // socket.io-client's constructor takes), but the browser's actual
    // WebSocket upgrade connects over ws(s) — a distinct CSP connect-src
    // scheme. Without both, the browser blocks the upgrade itself and the
    // socket only ever reports a generic transport error, never a CSP
    // violation, which is what made this easy to miss.
    const httpsPolicy = buildContentSecurityPolicy({
      nonce: "test-nonce",
      isDevelopment: false,
      apiUrl: "https://api.sentry.sinan.om/api/v1",
      websocketUrl: "https://api.sentry.sinan.om",
      mediaOrigins: "",
    });
    expect(httpsPolicy).toContain("https://api.sentry.sinan.om");
    expect(httpsPolicy).toContain("wss://api.sentry.sinan.om");

    const httpPolicy = buildContentSecurityPolicy({
      nonce: "dev-nonce",
      isDevelopment: true,
      apiUrl: "http://localhost:4000/api/v1",
      websocketUrl: "http://localhost:4000",
      mediaOrigins: "",
    });
    expect(httpPolicy).toContain("http://localhost:4000");
    expect(httpPolicy).toContain("ws://localhost:4000");
  });

  it("does not duplicate the origin when it is already ws(s)-scheme", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "test-nonce",
      isDevelopment: false,
      apiUrl: "https://api.sentry.sinan.om/api/v1",
      websocketUrl: "wss://api.sentry.sinan.om",
      mediaOrigins: "",
    });
    expect(
      policy.match(/wss:\/\/api\.sentry\.sinan\.om/g),
    ).toHaveLength(1);
  });

  it("permits development evaluation without weakening production", () => {
    const developmentPolicy = buildContentSecurityPolicy({
      nonce: "dev-nonce",
      isDevelopment: true,
      apiUrl: "http://localhost:4000/api/v1",
      websocketUrl: "ws://localhost:4000",
      mediaOrigins: "",
    });

    expect(developmentPolicy).toContain("'unsafe-eval'");
    expect(developmentPolicy).not.toContain("upgrade-insecure-requests");
  });
});
