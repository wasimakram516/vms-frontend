import api from "./api";
import withApiHandler from "@/utils/withApiHandler";
import { showGlobalMessage } from "@/contexts/MessageContext";

const mapHostToFrontend = (host) => ({
  id: host.id,
  name: host.name,
  email: host.email,
  phone: host.phone,
  address: host.address,
  mapUrl: host.mapUrl || "",
  website: host.website,
  logoUrl: host.logoUrl,
  contactPersonName: host.contactPersonName,
  contactPersonEmail: host.contactPersonEmail,
  contactPersonPhone: host.contactPersonPhone,
  isKitchenModuleEnabled: host.isKitchenModuleEnabled,
  ndaNotificationEmail: host.ndaNotificationEmail || "",
  exitTimeoutEnabled: host.exitTimeoutEnabled ?? false,
  exitTimeoutMinutes: host.exitTimeoutMinutes ?? 60,
  checkInBufferMinutes: host.checkInBufferMinutes ?? 60,
  notifyOutsideWorkingHours: host.notifyOutsideWorkingHours ?? false,
  workingHoursStart: host.workingHoursStart ?? 8,
  workingHoursStartMinute: host.workingHoursStartMinute ?? 0,
  workingHoursEnd: host.workingHoursEnd ?? 17,
  workingHoursEndMinute: host.workingHoursEndMinute ?? 0,
  // Default to Oman working week (Sun–Thu) if not yet configured
  workingDays: host.workingDays ?? [0, 1, 2, 3, 4],
  weekendDays: host.weekendDays ?? [5, 6],
  notifyOutsideWorkingDays: host.notifyOutsideWorkingDays ?? false,
  created_at: host.createdAt,
  updated_at: host.updatedAt,
  created_by: host.createdBy?.fullName || host.createdById || null,
  updated_by: host.updatedBy?.fullName || host.updatedById || null,
});

export const getHost = async () => {
  try {
    const res = await api.get("/host");
    const data = res.data?.data || res.data || null;
    return data ? mapHostToFrontend(data) : null;
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

export const getHostForKitchen = async () => {
  try {
    const res = await api.get("/host/for-kitchen");
    const data = res.data?.data || res.data || null;
    return data ? mapHostToFrontend(data) : null;
  } catch (err) {
    if (err?.response?.status === 404) return null;
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

export const getWorkingHours = async () => {
  try {
    const res = await api.get("/host/working-hours");
    return res.data?.data ?? res.data ?? null;
  } catch {
    return null;
  }
};

export const deleteHost = withApiHandler(
  async () => {
    await api.delete("/host");
    return { success: true };
  },
  { showSuccess: true }
);
