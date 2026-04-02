import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

export const getAccessLevels = withApiHandler(async (activeOnly = false) => {
  const res = await api.get("/access-levels", { params: activeOnly ? { activeOnly: "true" } : {} });
  return res.data?.data || res.data || [];
});

export const createAccessLevel = withApiHandler(
  async (payload) => {
    const res = await api.post("/access-levels", payload);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const updateAccessLevel = withApiHandler(
  async (id, payload) => {
    const res = await api.patch(`/access-levels/${id}`, payload);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const deleteAccessLevel = withApiHandler(
  async (id) => {
    const res = await api.delete(`/access-levels/${id}`);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);
