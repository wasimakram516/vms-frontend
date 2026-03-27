import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

export const getNdaForms = withApiHandler(async () => {
  const res = await api.get("/nda-templates/acceptances/forms");
  return res.data?.data || res.data || [];
});
