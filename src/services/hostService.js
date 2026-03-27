import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

export const getHost = withApiHandler(async () => {
  const res = await api.get("/host");
  return res.data?.data || res.data || null;
});

export const createHost = withApiHandler(
  async (data) => {
    const res = await api.post("/host", data);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const updateHost = withApiHandler(
  async (data) => {
    const res = await api.patch("/host", data);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const deleteHost = withApiHandler(
  async () => {
    await api.delete("/host");
    return { success: true };
  },
  { showSuccess: true }
);
