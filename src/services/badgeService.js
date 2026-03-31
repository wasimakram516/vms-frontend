import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

const mapBadgeTemplateToFrontend = (template) => ({
  id: template.id,
  name: template.name,
  isDefault: template.isDefault,
  isActive: template.isActive,
  layoutJson: template.layoutJson,
  created_at: template.createdAt,
  updated_at: template.updatedAt,
  created_by: template.createdBy?.fullName || template.createdById || null,
  updated_by: template.updatedBy?.fullName || template.updatedById || null,
});

export const getBadgeTemplates = withApiHandler(async () => {
  const response = await api.get("/badge-templates");
  const data = response.data?.data || response.data || [];
  return data.map(mapBadgeTemplateToFrontend);
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
