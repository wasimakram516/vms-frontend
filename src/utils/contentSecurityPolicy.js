/** Convert an HTTP, WebSocket, or public asset URL to a safe CSP origin. */
const toOrigin = (value) => {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
};

/**
 * CSP `connect-src` matches by scheme: an `http(s)://` entry does not also
 * permit a `ws(s)://` connection to that same host, even though browsers
 * negotiate the WebSocket transport against the identical origin. Without
 * this, every WebSocket upgrade is silently blocked by CSP itself — the
 * socket never reports a CSP violation as its failure reason, just a generic
 * transport error, which made this easy to miss.
 */
const toWebSocketVariant = (origin) => {
  if (origin?.startsWith("https://")) return `wss://${origin.slice(8)}`;
  if (origin?.startsWith("http://")) return `ws://${origin.slice(7)}`;
  return null;
};

/** Normalize a comma-separated origin allowlist and discard invalid values. */
const parseOrigins = (value) =>
  Array.from(new Set((value || "").split(",").map(toOrigin).filter(Boolean)));

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/** Build the per-request CSP used by the Next.js proxy. */
export const buildContentSecurityPolicy = ({
  nonce,
  isDevelopment,
  apiUrl,
  websocketUrl,
  mediaOrigins,
}) => {
  const apiOrigin = toOrigin(apiUrl);
  const websocketOrigin = toOrigin(websocketUrl);
  const trustedMediaOrigins = parseOrigins(mediaOrigins);
  const connectSources = Array.from(
    new Set(
      [
        "'self'",
        apiOrigin,
        websocketOrigin,
        toWebSocketVariant(websocketOrigin),
        ...trustedMediaOrigins,
        "https://fonts.gstatic.com",
        TURNSTILE_ORIGIN,
      ].filter(Boolean),
    ),
  );
  const imageSources = Array.from(
    new Set(
      [
        "'self'",
        "data:",
        "blob:",
        apiOrigin,
        ...trustedMediaOrigins,
        "https://flagcdn.com",
      ].filter(Boolean),
    ),
  );
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    TURNSTILE_ORIGIN,
  ];
  if (isDevelopment) scriptSources.push("'unsafe-eval'");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    `style-src-elem 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    `img-src ${imageSources.join(" ")}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSources.join(" ")}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "report-uri /api/csp-report",
    "report-to csp-endpoint",
  ];

  if (!isDevelopment) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
};
