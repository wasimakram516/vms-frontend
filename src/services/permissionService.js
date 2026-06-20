import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

// ── Permissions ────────────────────────────────────────────────────────────────

export const listPermissions = withApiHandler(async () => {
  const { data } = await api.get("/permissions");
  return data?.data ?? data ?? [];
});

export const createPermission = withApiHandler(
  async (payload) => {
    const { data } = await api.post("/permissions", payload);
    return data?.data ?? data;
  },
  { showSuccess: true },
);

export const updatePermission = withApiHandler(
  async (id, payload) => {
    const { data } = await api.patch(`/permissions/${id}`, payload);
    return data?.data ?? data;
  },
  { showSuccess: true },
);

export const deletePermission = withApiHandler(
  async (id) => {
    const { data } = await api.delete(`/permissions/${id}`);
    return data?.data ?? data;
  },
  { showSuccess: true },
);

// ── Role permissions ───────────────────────────────────────────────────────────

export const getRolePermissions = withApiHandler(async (roleKey) => {
  const { data } = await api.get(`/role-permissions/${roleKey}`);
  // Controller returns { roleKey, permissions: [...] } wrapped by ResponseInterceptor
  const payload = data?.data ?? data;
  return Array.isArray(payload) ? payload : (payload?.permissions ?? []);
});

export const setRolePermissions = withApiHandler(
  async (roleKey, permissions) => {
    // DTO requires roleKey in the body alongside permissions
    // Return full response body so withApiHandler can show the success message
    const { data } = await api.put(`/role-permissions/${roleKey}`, { roleKey, permissions });
    return data;
  },
  { showSuccess: true },
);

// ── User overrides ─────────────────────────────────────────────────────────────

export const getUserOverrides = withApiHandler(async (userId) => {
  const { data } = await api.get(`/users/${userId}/permission-overrides`);
  // Controller returns { userId, overrides: [...] } wrapped by ResponseInterceptor
  const payload = data?.data ?? data;
  return Array.isArray(payload) ? payload : (payload?.overrides ?? []);
});

export const setUserOverrides = withApiHandler(
  async (userId, overrides) => {
    const { data } = await api.put(`/users/${userId}/permission-overrides`, { overrides });
    return data;
  },
  { showSuccess: true },
);
