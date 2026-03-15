import api from "@/services/api";
import withApiHandler from "@/utils/withApiHandler";

export const globalSearch = withApiHandler(async (q) => {
  const { data } = await api.get("/global-search", { params: { q: String(q).trim() } });
  return data;
});
