import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

const mapCustomFieldToFrontend = (field) => ({
  id: field.id,
  fieldKey: field.fieldKey,
  label: field.label,
  inputType: field.inputType,
  isRequired: field.isRequired,
  isActive: field.isActive,
  isUnique: field.isUnique,
  uniquenessGroup: field.uniquenessGroup || "",
  isVipFastTrack: field.isVipFastTrack ?? false,
  sortOrder: field.sortOrder,
  optionsJson: field.optionsJson,
  dependentsJson: field.dependentsJson ?? null,
  created_at: field.createdAt,
  updated_at: field.updatedAt,
  created_by: field.createdBy?.fullName || field.createdById || null,
  updated_by: field.updatedBy?.fullName || field.updatedById || null,
});

export const getCustomFields = withApiHandler(async () => {
  const res = await api.get("/custom-fields");
  const data = res.data?.data || [];
  const mapped = Array.isArray(data) ? data.map(mapCustomFieldToFrontend) : [];
  return mapped.sort((a, b) => a.sortOrder - b.sortOrder);
});

export const createCustomField = withApiHandler(
  async (data) => {
    const res = await api.post("/custom-fields", data);
    return res.data?.data;
  },
  { showSuccess: true }
);

export const updateCustomField = withApiHandler(
  async (id, data) => {
    const res = await api.patch(`/custom-fields/${id}`, data);
    return res.data?.data;
  },
  { showSuccess: true }
);

export const deleteCustomField = withApiHandler(
  async (id) => {
    await api.delete(`/custom-fields/${id}`);
    return { success: true };
  },
  { showSuccess: true }
);
