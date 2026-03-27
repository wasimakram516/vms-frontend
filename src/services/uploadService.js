import api from "./api";

export const requestUploadAuthorization = async ({ fileName, fileType }) => {
  const { data } = await api.post("/upload/authorize", { fileName, fileType });
  return data.data;
};
