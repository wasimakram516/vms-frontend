import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

export const getBadgeTemplates = withApiHandler(async () => {
  const response = await api.get("/badge-templates");
  return response.data;
});

export const getDefaultBadgeTemplate = withApiHandler(async () => {
  const response = await api.get("/badge-templates/default");
  return response.data;
});

export const createBadgeTemplate = withApiHandler(
  async (templateData) => {
    const response = await api.post("/badge-templates", templateData);
    return response.data;
  },
  { showSuccess: true }
);

export const updateBadgeTemplate = withApiHandler(
  async (id, templateData) => {
    const response = await api.put(`/badge-templates/${id}`, templateData);
    return response.data;
  },
  { showSuccess: true }
);

export const deleteBadgeTemplate = withApiHandler(
  async (id) => {
    const response = await api.delete(`/badge-templates/${id}`);
    return response.data;
  },
  { showSuccess: true }
);

export const setDefaultBadgeTemplate = withApiHandler(
  async (id) => {
    const response = await api.patch(`/badge-templates/${id}/set-default`);
    return response.data;
  },
  { showSuccess: true }
);
