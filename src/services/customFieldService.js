import api from "./api";

export const getCustomFields = async () => {
  try {
    const res = await api.get("/custom-fields");
    const data = res.data?.data || [];
    return data.sort((a,b) => a.sortOrder - b.sortOrder);
  } catch (err) {
    console.error("Failed to fetch custom fields", err);
    return [];
  }
};

export const createCustomField = async (data) => {
  try {
    const res = await api.post("/custom-fields", data);
    return res.data?.data;
  } catch (err) {
    console.error("Failed to create custom field", err);
    throw err;
  }
};

export const updateCustomField = async (id, data) => {
  try {
    const res = await api.patch(`/custom-fields/${id}`, data);
    return res.data?.data;
  } catch (err) {
    console.error("Failed to update custom field", err);
    throw err;
  }
};

export const deleteCustomField = async (id) => {
  try {
    await api.delete(`/custom-fields/${id}`);
    return true;
  } catch (err) {
    console.error("Failed to delete custom field", err);
    throw err;
  }
};
