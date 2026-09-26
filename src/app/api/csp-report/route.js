import { NextResponse } from "next/server";

const MAX_REPORT_BYTES = 64 * 1024;

/** Keep only origin and pathname so CSP telemetry cannot leak query secrets. */
const sanitizeUrl = (value) => {
  if (typeof value !== "string" || !value) return null;
  if (["inline", "eval", "self"].includes(value)) return value;

  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.slice(0, 256);
  }
};

/** Accept browser CSP reports and emit a bounded structured security event. */
export async function POST(request) {
  const rawReport = await request.text();
  if (Buffer.byteLength(rawReport, "utf8") > MAX_REPORT_BYTES) {
    return NextResponse.json({ error: "Report too large" }, { status: 413 });
  }

  try {
    const parsed = JSON.parse(rawReport);
    const report = parsed?.["csp-report"] ?? parsed?.body ?? parsed;
    console.warn("csp_violation", {
      documentUri: sanitizeUrl(report?.["document-uri"] ?? report?.documentURL),
      blockedUri: sanitizeUrl(report?.["blocked-uri"] ?? report?.blockedURL),
      effectiveDirective:
        report?.["effective-directive"] ?? report?.effectiveDirective ?? null,
      disposition: report?.disposition ?? null,
      statusCode: report?.["status-code"] ?? report?.statusCode ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Invalid CSP report" }, { status: 400 });
  }

  return new NextResponse(null, { status: 204 });
}
