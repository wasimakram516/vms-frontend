import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

export const getDepartments = withApiHandler(async (activeOnly = false) => {
  const res = await api.get("/departments", { params: activeOnly ? { activeOnly: "true" } : {} });
  return res.data?.data || res.data || [];
});

export const createDepartment = withApiHandler(
  async (payload) => {
    const res = await api.post("/departments", payload);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const updateDepartment = withApiHandler(
  async (id, payload) => {
    const res = await api.patch(`/departments/${id}`, payload);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const deleteDepartment = withApiHandler(
  async (id) => {
    const res = await api.delete(`/departments/${id}`);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);
