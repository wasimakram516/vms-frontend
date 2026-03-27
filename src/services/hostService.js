import api from "./api";
import withApiHandler from "@/utils/withApiHandler";
import { showGlobalMessage } from "@/contexts/MessageContext";

export const getHost = async () => {
  try {
    const res = await api.get("/host");
    return res.data?.data || res.data || null;
  } catch (err) {
    if (err?.response?.status === 404) return null;
    const message =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      "Failed to load host details";
    showGlobalMessage(message, "error");
    return null;
  }
};

export const createHost = withApiHandler(
  async (data) => {
    const res = await api.post("/host", data);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const updateHost = withApiHandler(
  async (data) => {
    const res = await api.patch("/host", data);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const deleteHost = withApiHandler(
  async () => {
    await api.delete("/host");
    return { success: true };
  },
  { showSuccess: true }
);
