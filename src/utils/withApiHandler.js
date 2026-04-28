import { showGlobalMessage } from "@/contexts/MessageContext";

const withApiHandler = (fn, { showSuccess = false, suppressErrorStatus = [], silent = false } = {}) => async (...args) => {
  try {
    const response = await fn(...args);

    if (response?.success === false) {
      if (!silent) showGlobalMessage(response.message || "Something went wrong", "error");
      return { error: true, message: response.message };
    }

    if (showSuccess && response?.message) {
      showGlobalMessage(response.message, "success");
    }

    return response.data ?? response;
    
  } catch (err) {
    const status = err?.response?.status;
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      "An unknown error occurred";

    // Only show global message if not suppressed for this status
    if (!silent && !suppressErrorStatus.includes(status)) {
      showGlobalMessage(message, "error");
    }
    
    return { error: true, message, status };
  }
};

export default withApiHandler;
