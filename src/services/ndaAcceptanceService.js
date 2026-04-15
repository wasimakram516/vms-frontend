import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

export const getNdaForms = withApiHandler(async () => {
  const res = await api.get("/nda-templates/acceptances/forms");
  return res.data?.data || res.data || [];
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
