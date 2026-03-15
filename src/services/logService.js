import api from "@/services/api";
import withApiHandler from "@/utils/withApiHandler";

export const getLogs = withApiHandler(async (params = {}) => {
  const { data } = await api.get("/logs", { params });
  return data;
});

export const getLogStats = withApiHandler(async (params = {}) => {
  const { data } = await api.get("/logs/stats", { params });
  return data;
});

// Export logs (all or filtered by query params) as CSV
export const exportLogs = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const url = `/logs/export${qs ? `?${qs}` : ""}`;
  const response = await api.get(url, { responseType: "blob" });
  return response.data;
};

