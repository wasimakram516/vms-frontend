import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

export const getCustomFields = withApiHandler(async () => {
  const res = await api.get("/custom-fields");
  const data = res.data?.data || [];
  return data.sort((a, b) => a.sortOrder - b.sortOrder);
});

export const createCustomField = withApiHandler(
  async (data) => {
    const res = await api.post("/custom-fields", data);
    return res.data?.data;
  },
  { showSuccess: true }
);

export const updateCustomField = withApiHandler(
  async (id, data) => {
    const res = await api.patch(`/custom-fields/${id}`, data);
    return res.data?.data;
  },
  { showSuccess: true }
);

export const deleteCustomField = withApiHandler(
  async (id) => {
    await api.delete(`/custom-fields/${id}`);
    return { success: true };
  },
  { showSuccess: true }
);
