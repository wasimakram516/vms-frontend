import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

export const getPublicActiveNdaTemplate = withApiHandler(async () => {
  const res = await api.get("/nda-templates/public/active");
  return res.data?.data || res.data || null;
});

export const getNdaTemplates = withApiHandler(async () => {
  const res = await api.get("/nda-templates");
  return res.data?.data || res.data || [];
});

export const getNdaTemplate = withApiHandler(async (id) => {
  const res = await api.get(`/nda-templates/${id}`);
  return res.data?.data || res.data;
});

export const createNdaTemplate = withApiHandler(
  async (data) => {
    const res = await api.post("/nda-templates", data);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const updateNdaTemplate = withApiHandler(
  async (id, data) => {
    const res = await api.patch(`/nda-templates/${id}`, data);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const deactivateNdaTemplate = withApiHandler(
  async (id) => {
    const res = await api.patch(`/nda-templates/${id}/deactivate`);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const activateNdaTemplate = withApiHandler(
  async (id) => {
    const res = await api.patch(`/nda-templates/${id}/activate`);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const deleteNdaTemplate = withApiHandler(
  async (id) => {
    await api.delete(`/nda-templates/${id}`);
    return { success: true };
  },
  { showSuccess: true }
);
