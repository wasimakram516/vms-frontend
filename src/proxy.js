import { NextResponse } from "next/server";
import { buildContentSecurityPolicy } from "@/utils/contentSecurityPolicy";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

/** Generate a unique cryptographic nonce for a single HTML response. */
const createNonce = () => Buffer.from(crypto.randomUUID()).toString("base64");

/** Add CSP and browser security headers before rendering an application route. */
export function proxy(request) {
  const nonce = createNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce,
    isDevelopment: IS_DEVELOPMENT,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_HOST,
    mediaOrigins: process.env.NEXT_PUBLIC_MEDIA_ORIGINS,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set(
    "Reporting-Endpoints",
    'csp-endpoint="/api/csp-report"',
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
  );
  if (!IS_DEVELOPMENT) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
