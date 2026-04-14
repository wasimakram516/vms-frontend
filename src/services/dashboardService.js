import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

export const getLiveVisitors = withApiHandler(async () => {
  const res = await api.get("/dashboard/live");
  return res.data?.data ?? res.data;
});

export const getDashboardStats = withApiHandler(async (period = "today") => {
  const params = period && period !== "all" ? { period } : {};
  const res = await api.get("/dashboard/stats", { params });
  return res.data?.data ?? res.data;
});

/**
 * Downloads the visitor report Excel file.
 */
export async function exportVisitorReport({ period = "monthly", from, to } = {}) {
  const params = new URLSearchParams({ period });
  if (period === "custom" && from && to) {
    params.set("from", from);
    params.set("to", to);
  }
  params.set("tzOffset", String(new Date().getTimezoneOffset()));

  const res = await api.get(`/dashboard/export?${params.toString()}`, {
    responseType: "blob",
  });

  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `visitor-report-${period}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
