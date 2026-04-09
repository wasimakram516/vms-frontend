import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

// ── Query string builder ───────────────────────────────────────────────────────
// tzOffset: JS getTimezoneOffset() — minutes to add to local to get UTC
// e.g. UTC+4 (Oman) → -240, UTC-5 → +300
function buildParams(from, to) {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to)   p.set("to", to);
  p.set("tzOffset", String(new Date().getTimezoneOffset()));
  return `?${p.toString()}`;
}

// ── Data endpoints ─────────────────────────────────────────────────────────────

export const getVolume = withApiHandler(async (from, to) => {
  const res = await api.get(`/analytics/volume${buildParams(from, to)}`);
  return res.data?.data ?? res.data;
});

export const getPeakHours = withApiHandler(async (from, to) => {
  const res = await api.get(`/analytics/peak-hours${buildParams(from, to)}`);
  return res.data?.data ?? res.data;
});

export const getFunnel = withApiHandler(async (from, to) => {
  const res = await api.get(`/analytics/funnel${buildParams(from, to)}`);
  return res.data?.data ?? res.data;
});

export const getBreakdown = withApiHandler(async (from, to) => {
  const res = await api.get(`/analytics/breakdown${buildParams(from, to)}`);
  return res.data?.data ?? res.data;
});

export const getApprovalTime = withApiHandler(async (from, to) => {
  const res = await api.get(`/analytics/approval-time${buildParams(from, to)}`);
  return res.data?.data ?? res.data;
});

export const getVisitDuration = withApiHandler(async (from, to) => {
  const res = await api.get(`/analytics/visit-duration${buildParams(from, to)}`);
  return res.data?.data ?? res.data;
});

// ── Export endpoints ───────────────────────────────────────────────────────────

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportExcel(from, to) {
  const res = await api.get(`/analytics/export/excel${buildParams(from, to)}`, {
    responseType: "blob",
  });
  triggerBlobDownload(
    res.data,
    `sinan-analytics-${from ?? "start"}-${to ?? "end"}.xlsx`
  );
}

export async function exportPdf(from, to) {
  const res = await api.get(`/analytics/export/pdf${buildParams(from, to)}`, {
    responseType: "blob",
  });
  triggerBlobDownload(
    res.data,
    `sinan-analytics-${from ?? "start"}-${to ?? "end"}.pdf`
  );
}
