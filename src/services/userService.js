import api from "./api";
import withApiHandler from "@/utils/withApiHandler";
import { getCountryCodeByIsoCode } from "@/utils/countryCodes";

const buildFullPhone = (phone, isoCode) => {
  if (!phone) return phone;
  if (phone.startsWith("+")) return phone;
  const country = getCountryCodeByIsoCode(isoCode);
  return country ? `${country.code}${phone}` : phone;
};

const mapUserToFrontend = (user) => ({
  id: user.id,
  full_name: user.fullName,
  email: user.email,
  role: user.role,
  phone: user.phone,
  iso_code: user.iso_code || user.phoneIsoCode || user.isoCode,
  staff_type: user.staffType,
  adminType: user.adminType,
  status: user.status,
  departments: Array.isArray(user.departments) ? user.departments : [],
  created_at: user.createdAt,
  updated_at: user.updatedAt,
  created_by: user.createdBy?.fullName || user.createdById || null,
  updated_by: user.updatedBy?.fullName || user.updatedById || null,
});

export const getAllUsers = withApiHandler(async (role) => {
  const res = await api.get("/users", { params: { role } });
  const users = res.data?.data || res.data || [];
  return Array.isArray(users) ? users.map(mapUserToFrontend) : [];
});

export const createSuperAdminUser = withApiHandler(
  async (data) => {
    const res = await api.post("/users/superadmin", {
      fullName: data.full_name,
      email: data.email,
      phone: buildFullPhone(data.phone, data.phoneIsoCode),
      phoneIsoCode: data.phoneIsoCode,
      password: data.password || undefined,
    });
    const userData = res.data?.data || res.data;
    return userData ? mapUserToFrontend(userData) : null;
  },
  { showSuccess: true }
);

export const createAdminUser = withApiHandler(
  async (data) => {
    const res = await api.post("/users/admin", {
      fullName: data.full_name,
      email: data.email,
      phone: buildFullPhone(data.phone, data.phoneIsoCode),
      phoneIsoCode: data.phoneIsoCode,
      password: data.password || undefined,
      adminType: data.adminType || undefined,
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
      phone: buildFullPhone(data.phone, data.phoneIsoCode),
      phoneIsoCode: data.phoneIsoCode,
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
    const payload = {
      fullName: data.full_name,
      email: data.email,
      phone: buildFullPhone(data.phone, data.phoneIsoCode),
      phoneIsoCode: data.phoneIsoCode,
      role: data.role,
      status: data.status,
      password: data.password || undefined,
    };
    // Only include staffType for staff roles
    if (data.role === "staff") {
      payload.staffType = data.staff_type;
    }
    if (data.role === "admin") {
      payload.adminType = data.adminType;
    }
    const res = await api.patch(`/users/${id}`, payload);
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

export const assignUserDepartments = withApiHandler(
  async (userId, departmentIds) => {
    const res = await api.put(`/users/${userId}/departments`, { departmentIds });
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const getUserById = withApiHandler(async (id) => {
  const res = await api.get(`/users/${id}`);
  const userData = res.data?.data || res.data;
  return userData ? mapUserToFrontend(userData) : null;
});
