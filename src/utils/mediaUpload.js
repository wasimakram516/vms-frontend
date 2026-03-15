import { requestUploadAuthorization } from "@/services/uploadService";

const parseS3ErrorResponse = (responseText) => {
  if (!responseText) {
    return "";
  }

  try {
    if (responseText.includes("<Error>")) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(responseText, "text/xml");
      const code = xmlDoc.querySelector("Code")?.textContent || "";
      const message = xmlDoc.querySelector("Message")?.textContent || "";

      if (code || message) {
        return `${code}: ${message}`.trim();
      }
    }
  } catch (error) {
    console.error("Error parsing upload response:", error);
  }

  return responseText;
};

const getRequestErrorMessage = (error) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  "Failed to authorize upload.";

const getUploadErrorMessage = (status, responseText) => {
  if (status === 403) {
    return `Access denied (403). ${
      responseText ||
      "The temporary upload authorization was rejected. Check S3 CORS and signed URL expiry."
    }`;
  }

  if (status === 400) {
    return `Bad request (400). ${responseText || "Please check file format and size."}`;
  }

  return `Upload failed (${status})${responseText ? `: ${responseText}` : ""}`;
};

export const uploadMediaFiles = async ({
  files,
  businessSlug,
  moduleName,
  onProgress,
  wallSlug,
}) => {
  if (!files || files.length === 0) return [];

  const uploads = files.map((file) => ({
    file,
    label: file.name,
    percent: 0,
    loaded: 0,
    total: file.size,
    error: null,
    url: null,
  }));

  if (onProgress) {
    onProgress([...uploads]);
  }

  const uploadPromises = uploads.map(async (upload) => {
    try {
      const uploadAuthorization = await requestUploadAuthorization({
        businessSlug,
        fileName: upload.file.name,
        fileType: upload.file.type || "application/octet-stream",
        moduleName,
        wallSlug,
      });

      const uploadUrl =
        uploadAuthorization?.uploadUrl || uploadAuthorization?.uploadURL;

      if (!uploadUrl || !uploadAuthorization?.fileUrl) {
        throw new Error("Upload authorization response is incomplete.");
      }

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            upload.percent = Math.round((event.loaded / event.total) * 100);
            upload.loaded = event.loaded;
            upload.total = event.total;

            if (onProgress) {
              onProgress([...uploads]);
            }
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 204) {
            upload.percent = 100;
            upload.url = uploadAuthorization.fileUrl;

            if (onProgress) {
              onProgress([...uploads]);
            }

            resolve();
            return;
          }

          const responseText = parseS3ErrorResponse(xhr.responseText || "");
          const errorMessage = getUploadErrorMessage(xhr.status, responseText);

          console.error("Upload error details:", {
            status: xhr.status,
            statusText: xhr.statusText,
            responseText,
            uploadUrl: `${uploadUrl.substring(0, 100)}...`,
          });

          upload.error = errorMessage;
          if (onProgress) {
            onProgress([...uploads]);
          }

          reject(new Error(errorMessage));
        };

        xhr.onerror = () => {
          upload.error = "Network error during upload";
          if (onProgress) {
            onProgress([...uploads]);
          }
          reject(new Error("Network error during upload"));
        };

        Object.entries(uploadAuthorization.headers || {}).forEach(
          ([headerName, headerValue]) => {
            if (headerValue) {
              xhr.setRequestHeader(headerName, headerValue);
            }
          }
        );

        xhr.send(upload.file);
      });

      return uploadAuthorization.fileUrl;
    } catch (error) {
      upload.error = getRequestErrorMessage(error);
      if (onProgress) {
        onProgress([...uploads]);
      }
      throw new Error(upload.error);
    }
  });

  return Promise.all(uploadPromises);
};

export const uploadSingleFile = async ({
  file,
  businessSlug,
  moduleName,
  onProgress,
  wallSlug,
}) => {
  const [url] = await uploadMediaFiles({
    files: [file],
    businessSlug,
    moduleName,
    onProgress: (uploads) => {
      if (uploads[0] && onProgress) {
        onProgress(uploads[0].percent, uploads[0].loaded, uploads[0].total);
      }
    },
    wallSlug,
  });

  return url;
};
