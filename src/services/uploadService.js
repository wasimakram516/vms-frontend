import api from "./api";

export const requestUploadAuthorization = async ({
  fileName,
  fileType,
  fileSize,
}) => {
  const { data } = await api.post("/upload/authorize", {
    fileName,
    fileType,
    fileSize,
  });
  return data.data;
};
