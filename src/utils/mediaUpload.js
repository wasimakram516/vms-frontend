import { requestUploadAuthorization } from "@/services/uploadService";

const parseS3ErrorResponse = (responseText) => {
  if (!responseText) return "";
  try {
    if (responseText.includes("<Error>")) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(responseText, "text/xml");
      const code = xmlDoc.querySelector("Code")?.textContent || "";
      const message = xmlDoc.querySelector("Message")?.textContent || "";
      if (code || message) return `${code}: ${message}`.trim();
    }
  } catch (error) {
    console.error("Error parsing S3 error response:", error);
  }
  return responseText;
};

const getRequestErrorMessage = (error) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  "Failed to authorize upload.";

const getUploadErrorMessage = (status, responseText) => {
  if (status === 403)
    return `Access denied (403). ${responseText || "The signed URL was rejected. Check S3 CORS and expiry."}`;
  if (status === 400)
    return `Bad request (400). ${responseText || "Please check the file format and size."}`;
  return `Upload failed (${status})${responseText ? `: ${responseText}` : ""}`;
};

/**
 * Upload one or more files directly to S3 via pre-signed URLs.
 *
 * @param {Object} params
 * @param {File[]} params.files          - Array of File objects to upload
 * @param {Function} [params.onProgress] - Called with the uploads array on every progress tick
 * @returns {Promise<string[]>}          - Resolved CloudFront/S3 URLs in the same order as files
 */
export const uploadMediaFiles = async ({ files, onProgress }) => {
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

  if (onProgress) onProgress([...uploads]);

  const uploadPromises = uploads.map(async (upload) => {
    try {
      const auth = await requestUploadAuthorization({
        fileName: upload.file.name,
        fileType: upload.file.type || "application/octet-stream",
      });

      const uploadUrl = auth?.uploadUrl || auth?.uploadURL;
      if (!uploadUrl || !auth?.fileUrl) {
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
            if (onProgress) onProgress([...uploads]);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 204) {
            upload.percent = 100;
            upload.url = auth.fileUrl;
            if (onProgress) onProgress([...uploads]);
            resolve();
            return;
          }
          const responseText = parseS3ErrorResponse(xhr.responseText || "");
          const errorMessage = getUploadErrorMessage(xhr.status, responseText);
          console.error("S3 upload error:", { status: xhr.status, responseText });
          upload.error = errorMessage;
          if (onProgress) onProgress([...uploads]);
          reject(new Error(errorMessage));
        };

        xhr.onerror = () => {
          upload.error = "Network error during upload.";
          if (onProgress) onProgress([...uploads]);
          reject(new Error("Network error during upload."));
        };

        Object.entries(auth.headers || {}).forEach(([name, value]) => {
          if (value) xhr.setRequestHeader(name, value);
        });

        xhr.send(upload.file);
      });

      return auth.fileUrl;
    } catch (error) {
      upload.error = getRequestErrorMessage(error);
      if (onProgress) onProgress([...uploads]);
      throw new Error(upload.error);
    }
  });

  return Promise.all(uploadPromises);
};

/**
 * Convenience wrapper for uploading a single file.
 *
 * @param {Object} params
 * @param {File} params.file
 * @param {Function} [params.onProgress] - Called with (percent, loaded, total)
 * @returns {Promise<string>} Resolved CloudFront/S3 URL
 */
export const uploadSingleFile = async ({ file, onProgress }) => {
  const [url] = await uploadMediaFiles({
    files: [file],
    onProgress: onProgress
      ? (uploads) => {
          const u = uploads[0];
          if (u) onProgress(u.percent, u.loaded, u.total);
        }
      : undefined,
  });
  return url;
};
