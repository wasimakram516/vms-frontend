"use client";

import { useCallback, useEffect, useRef } from "react";
import Script from "next/script";
import { Box, Typography } from "@mui/material";

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const isTurnstileEnabled = Boolean(
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
);

/**
 * Render a Cloudflare Turnstile challenge and return its short-lived token.
 *
 * @param {object} props
 * @param {string} props.action Stable server-validated action for this flow.
 * @param {(token: string) => void} props.onTokenChange Token state callback.
 * @param {number} [props.resetKey] Increment after every attempted request.
 */
export default function TurnstileWidget({
  action,
  onTokenChange,
  resetKey = 0,
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  const renderWidget = useCallback(() => {
    const turnstile = window.turnstile;
    const container = containerRef.current;
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!turnstile || !container || !siteKey || widgetIdRef.current !== null) {
      return;
    }

    widgetIdRef.current = turnstile.render(container, {
      sitekey: siteKey,
      action,
      theme: "auto",
      callback: (token) => onTokenChange(token),
      "expired-callback": () => onTokenChange(""),
      "error-callback": () => onTokenChange(""),
    });
  }, [action, onTokenChange]);

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      onTokenChange("");
    };
  }, [renderWidget]);

  useEffect(() => {
    if (widgetIdRef.current !== null && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      onTokenChange("");
    }
  }, [onTokenChange, resetKey]);

  if (!isTurnstileEnabled) {
    return process.env.NODE_ENV === "production" ? (
      <Typography color="error" role="alert" variant="body2">
        Bot verification is temporarily unavailable.
      </Typography>
    ) : null;
  }

  return (
    <>
      <Script
        id="cloudflare-turnstile"
        src={TURNSTILE_SCRIPT_URL}
        strategy="afterInteractive"
        onLoad={renderWidget}
      />
      <Box
        ref={containerRef}
        aria-label="Bot verification"
        sx={{ display: "flex", justifyContent: "center", minHeight: 65 }}
      />
    </>
  );
}
