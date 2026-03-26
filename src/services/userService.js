import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

const mapUserToFrontend = (user) => ({
  id: user.id,
  full_name: user.fullName,
  email: user.email,
  role: user.role,
  phone: user.phone,
  iso_code: user.isoCode,
  staff_type: user.staffType,
  status: user.status,
  created_at: user.createdAt,
});

export const getAllUsers = withApiHandler(async (role) => {
  const res = await api.get("/users", { params: { role } });
  const users = res.data?.data || res.data || [];
  return Array.isArray(users) ? users.map(mapUserToFrontend) : [];
});

export const createAdminUser = withApiHandler(
  async (data) => {
    const res = await api.post("/users/admin", {
      fullName: data.full_name,
      email: data.email,
      password: data.password || undefined,
    });
    const userData = res.data?.data || res.data;
    return userData ? mapUserToFrontend(userData) : null;
  },
  { showSuccess: true }
);

export const createStaffUser = withApiHandler(
  async (data) => {
    const res = await api.post("/users/staff", {
      fullName: data.full_name,
      email: data.email,
      password: data.password || undefined,
      staffType: data.staff_type,
    });
    const userData = res.data?.data || res.data;
    return userData ? mapUserToFrontend(userData) : null;
  },
  { showSuccess: true }
);

export const updateUser = withApiHandler(
  async (id, data) => {
    const res = await api.patch(`/users/${id}`, {
      fullName: data.full_name,
      email: data.email,
      role: data.role,
      staffType: data.staff_type,
      password: data.password || undefined,
    });
    const userData = res.data?.data || res.data;
    return userData ? mapUserToFrontend(userData) : null;
  },
  { showSuccess: true }
);

export const deleteUser = withApiHandler(
  async (id) => {
    await api.delete(`/users/${id}`);
    return { success: true };
  },
  { showSuccess: true }
);

export const getUserById = withApiHandler(async (id) => {
  const res = await api.get(`/users/${id}`);
  const userData = res.data?.data || res.data;
  return userData ? mapUserToFrontend(userData) : null;
});
