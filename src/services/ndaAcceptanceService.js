import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

export const getNdaForms = withApiHandler(async ({ page, limit, search } = {}) => {
  const res = await api.get("/nda-templates/acceptances/forms", { params: { page, limit, search } });
  const raw = res.data?.data || res.data || {};
  if (Array.isArray(raw)) {
    return { data: { data: raw, total: raw.length, page: 1, limit: raw.length } };
  }
  return { data: { data: raw.data || [], total: raw.total || 0, page: raw.page || 1, limit: raw.limit || 50 } };
});

export const deleteNdaAcceptance = withApiHandler(async (id) => {
  const res = await api.delete(`/nda-templates/acceptances/${id}`);
  return res.data;
});

export const resendNdaToHost = withApiHandler(async (id) => {
  const res = await api.post(`/nda-templates/acceptances/${id}/resend-host`);
  return res.data;
});

export const resendNdaToVisitor = withApiHandler(async (id) => {
  const res = await api.post(`/nda-templates/acceptances/${id}/resend-visitor`);
  return res.data;
});
