import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

export const getRolePagePermissions = withApiHandler(async (roleKey) => {
  const { data } = await api.get('/page-permissions/' + roleKey);
  const payload = data?.data ?? data;
  return Array.isArray(payload) ? payload : (payload?.permissions ?? []);
});

export const setRolePagePermissions = withApiHandler(
  async (roleKey, permissions) => {
    const { data } = await api.put('/page-permissions/' + roleKey, { permissions });
    return data;
  },
  { showSuccess: true },
);

export const getUserPageOverrides = withApiHandler(async (userId) => {
  const { data } = await api.get('/users/' + userId + '/page-overrides');
  const payload = data?.data ?? data;
  return Array.isArray(payload) ? payload : (payload?.overrides ?? []);
}, { suppressErrorStatus: [403] });

export const setUserPageOverrides = withApiHandler(
  async (userId, overrides) => {
    const { data } = await api.put('/users/' + userId + '/page-overrides', { overrides });
    return data;
  },
  { showSuccess: true },
);
