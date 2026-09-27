const MAX_REFRESH_WINDOW_MS = 120_000;
const MIN_REFRESH_WINDOW_MS = 5_000;
const REFRESH_LIFETIME_RATIO = 0.2;

/** Decode the timing claims needed for proactive access-token refresh. */
function getTokenTiming(token) {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;

    const normalized = encodedPayload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded));
    if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp))
      return null;

    return {
      issuedAt: payload.iat * 1000,
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}

/** Decide whether a token has entered the final portion of its lifetime. */
export function shouldRefreshAccessToken(token, now = Date.now()) {
  const timing = getTokenTiming(token);
  if (!timing) return false;

  const lifetime = timing.expiresAt - timing.issuedAt;
  if (lifetime <= 0) return true;

  const refreshWindow = Math.min(
    MAX_REFRESH_WINDOW_MS,
    Math.max(MIN_REFRESH_WINDOW_MS, lifetime * REFRESH_LIFETIME_RATIO),
  );
  return timing.expiresAt - now <= refreshWindow;
}
