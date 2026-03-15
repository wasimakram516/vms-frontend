import api from "@/services/api";
import withApiHandler from "@/utils/withApiHandler";

// Get trash items (supports filters: model, deletedBy, startDate, endDate, page, limit)
export const getTrash = withApiHandler(async (params = {}) => {
  const { data } = await api.get("/trash", { params });
  return data;
});

// Restore item by module + id
export const restoreTrashItem = withApiHandler(
  async (module, id) => {
    const { data } = await api.put(`/trash/${module}/${id}/restore`);
    return data;
  },
  { showSuccess: true }
);

// Permanently delete item by module + id
export const permanentDeleteTrashItem = withApiHandler(
  async (module, id) => {
    const { data } = await api.delete(`/trash/${module}/${id}/permanent`);
    return data;
  },
  { showSuccess: true }
);

export const getModuleCounts = withApiHandler(async () => {
  const { data } = await api.get("/trash/module-counts");
  return data;
});

// Bulk restore and delete operations
export const restoreAllTrashItems = withApiHandler(
  async (module, params = {}) => {
    const { data } = await api.put(`/trash/${module}/restore-all`, null, { params });
    return data;
  },
  { showSuccess: true }
);

export const permanentDeleteAllTrashItems = withApiHandler(
  async (module, params = {}) => {
    const { data } = await api.delete(`/trash/${module}/permanent-all`, { params });
    return data;
  },
  { showSuccess: true }
);

