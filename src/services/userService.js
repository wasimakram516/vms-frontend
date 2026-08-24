import api from "./api";
import withApiHandler from "@/utils/withApiHandler";
import { getCountryCodeByIsoCode } from "@/utils/countryCodes";

const buildFullPhone = (phone, isoCode) => {
  if (!phone) return phone;
  if (phone.startsWith("+")) return phone;
  const country = getCountryCodeByIsoCode(isoCode);
  return country ? `${country.code}${phone}` : phone;
};

export const mapUserToFrontend = (user) => ({
  id: user.id,
  full_name: user.fullName,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  phone: user.phone,
  iso_code: user.iso_code || user.phoneIsoCode || user.isoCode,
  staff_type: user.staffType,
  adminType: user.adminType,
  status: user.status,
  departments: Array.isArray(user.departments) ? user.departments : [],
  idNo: user.idNo || user.id_no || undefined,
  idType: user.idType || undefined,
  created_at: user.createdAt,
  updated_at: user.updatedAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  created_by: user.createdBy?.fullName || user.createdById || null,
  updated_by: user.updatedBy?.fullName || user.updatedById || null,
  createdBy: user.createdBy || null,
  updatedBy: user.updatedBy || null,
  companyName: user.companyName || user.company_name || null,
});

export const getAllUsers = withApiHandler(async (role, { page, limit, search } = {}) => {
  const res = await api.get("/users", { params: { role, page, limit, search } });
  const raw = res.data?.data || res.data || {};
  if (Array.isArray(raw)) {
    const mapped = raw.map(mapUserToFrontend);
    return { data: { data: mapped, total: mapped.length, page: 1, limit: mapped.length } };
  }
  const items = Array.isArray(raw.data) ? raw.data.map(mapUserToFrontend) : [];
  return { data: { data: items, total: raw.total || 0, page: raw.page || 1, limit: raw.limit || 50 } };
});

export const getVisitorUsers = withApiHandler(async ({ page, limit, search } = {}) => {
  const res = await api.get("/users/for-visitors", { params: { page, limit, search } });
  const raw = res.data?.data || res.data || {};
  if (Array.isArray(raw)) {
    const mapped = raw.map(mapUserToFrontend);
    return { data: { data: mapped, total: mapped.length, page: 1, limit: mapped.length } };
  }
  const items = Array.isArray(raw.data) ? raw.data.map(mapUserToFrontend) : [];
  return { data: { data: items, total: raw.total || 0, page: raw.page || 1, limit: raw.limit || 50 } };
});

export const createVisitorUser = withApiHandler(
  async (data) => {
    const res = await api.post("/users/for-visitors", {
      fullName: data.full_name,
      email: data.email,
      phone: data.phone || undefined,
      phoneIsoCode: data.phoneIsoCode || undefined,
      idNo: data.idNo || undefined,
      idType: data.idType || undefined,
      idCountry: data.idCountry || undefined,
    });
    const userData = res.data?.data || res.data;
    return userData ? mapUserToFrontend(userData) : null;
  },
  { showSuccess: true }
);

export const getVisitorUserById = withApiHandler(async (id) => {
  const res = await api.get(`/users/for-visitors/${id}`);
  const userData = res.data?.data || res.data;
  return userData ? mapUserToFrontend(userData) : null;
});

export const updateVisitorUser = withApiHandler(
  async (id, data) => {
    const payload = {
      fullName: data.full_name,
      email: data.email,
      phone: buildFullPhone(data.phone, data.phoneIsoCode),
      phoneIsoCode: data.phoneIsoCode,
      status: data.status,
    };
    const res = await api.patch(`/users/for-visitors/${id}`, payload);
    const userData = res.data?.data || res.data;
    return userData ? mapUserToFrontend(userData) : null;
  },
  { showSuccess: true }
);

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
