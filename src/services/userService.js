import api from "./api";

const mapUserToFrontend = (user) => ({
  id: user.id,
  full_name: user.fullName,
  email: user.email,
  role: user.role,
  phone: user.phone,
  staff_type: user.staffType,
  status: user.status,
  created_at: user.createdAt,
});

export const getAllUsers = async (role) => {
  try {
    const res = await api.get("/users", { params: { role } });
    const users = res.data?.data || res.data || [];
    return Array.isArray(users) ? users.map(mapUserToFrontend) : [];
  } catch (err) {
    console.error(err.message, err);
    throw err;
  }
};

export const createAdminUser = async (data) => {
  try {
    const res = await api.post("/users/admin", {
      fullName: data.full_name,
      email: data.email,
      password: data.password,
    });
    const userData = res.data?.data || res.data;
    return { success: true, data: userData ? mapUserToFrontend(userData) : null };
  } catch (err) {
    console.error("Failed to create admin", err);
    throw err;
  }
};

export const createStaffUser = async (data) => {
  try {
    const res = await api.post("/users/staff", {
      fullName: data.full_name,
      email: data.email,
      password: data.password,
    });
    const userData = res.data?.data || res.data;
    return { success: true, data: userData ? mapUserToFrontend(userData) : null };
  } catch (err) {
    console.error("Failed to create staff", err);
    throw err;
  }
};

export const updateUser = async (id, data) => {
  try {
    const res = await api.patch(`/users/${id}`, {
      fullName: data.full_name,
      email: data.email,
      role: data.role,
      password: data.password || undefined
    });
    const userData = res.data?.data || res.data;
    return { success: true, data: userData ? mapUserToFrontend(userData) : null };
  } catch (err) {
    console.error("Failed to update user", err);
    throw err;
  }
};

export const deleteUser = async (id) => {
  try {
    await api.delete(`/users/${id}`);
    return { success: true };
  } catch (err) {
    const message = err.response?.data?.message || err.message || "Failed to delete user";
    console.error("Failed to delete user", message);
    throw new Error(message);
  }
};

export const getUserById = async (id) => {
  try {
    const res = await api.get(`/users/${id}`);
    const userData = res.data?.data || res.data;
    return userData ? mapUserToFrontend(userData) : null;
  } catch (err) {
    console.error("Failed to get user", err);
    throw err;
  }
};
