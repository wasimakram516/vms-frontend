import api from "./api";
import axios from "axios";
import withApiHandler from "@/utils/withApiHandler";
import { showGlobalMessage } from "@/contexts/MessageContext";
import {
  getStoredToken,
  getStoredUser,
  setStoredAuthData,
  clearStoredAuthData,
  runSingleRefresh,
} from "@/utils/authStorage";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const mapUserToFrontend = (user) => {
  if (!user || typeof user !== "object") return null;
  return {
    ...user,
    full_name: user.fullName || user.full_name || "User",
    staff_type: user.staffType || user.staff_type || null,
    adminType: user.adminType || null,
    name: user.fullName || user.full_name || user.name || "User",
    isSuper: user.isSuper ?? false,
    isDev: user.isDev ?? false,

    permissions: user.permissions ?? [],
  };
};

export const getAuthData = () => {
  return {
    token: getStoredToken(),
    user: getStoredUser(),
  };
};

export const login = withApiHandler(
  async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    const accessToken = data?.accessToken || data?.data?.accessToken;

    if (!accessToken) {
      throw new Error("No access token received from server");
    }

    setStoredAuthData(accessToken, null);

    const userRes = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let user = userRes.data?.data || userRes.data;
    user = mapUserToFrontend(user);

    if (!user) {
      throw new Error("Failed to fetch user profile after login");
    }

    setStoredAuthData(accessToken, user);

    return { token: accessToken, user };
  },
  { showSuccess: true },
);

export const logout = async (redirectTo) => {
  const redirectPath = redirectTo || "/auth/login";

  try {
    await api.post("/auth/logout");
  } catch (err) {
    console.warn("Server logout failed or skipped", err);
  } finally {
    clearStoredAuthData();
    if (typeof window !== "undefined") {
      window.location.href = redirectPath;
    }
  }
};

const requestRefreshToken = withApiHandler(
  async () => {
    const res = await api.post("/auth/refresh");
    const token = res.data?.accessToken || res.data?.data?.accessToken;
    if (token) setStoredAuthData(token, getStoredUser());
    return token;
  },
  { silent: true },
);

export const refreshToken = () => runSingleRefresh(requestRefreshToken);

// Verify the current user's password before a sensitive action (e.g. logout).
export const verifyPassword = withApiHandler(
  async (password) => {
    const res = await api.post("/auth/verify-password", { password });
    return res.data?.data || res.data || { valid: true };
  },
  { silent: true },
);

// SuperAdmin only. Immediately revokes every refresh session for one account
// and force-disconnects any live socket connection it currently holds.
// Feedback is shaped by the actual result rather than a blanket success
// toast: revoking an account that already had no active session is a no-op
// on the backend (and never creates an audit entry for it), so the admin
// should be told that plainly instead of hearing "Session revoked" for
// something that didn't happen.
export const revokeUserSessions = withApiHandler(async (userId) => {
  const res = await api.post(`/auth/sessions/revoke/${userId}`);
  const result = res.data?.data || res.data;
  const count = Number(result?.revokedSessionCount) || 0;
  showGlobalMessage(
    count > 0
      ? `Session revoked — ${count} active session${count === 1 ? "" : "s"} ended.`
      : "No active session found for this account — nothing to revoke.",
    count > 0 ? "success" : "info",
  );
  return result;
});

// SuperAdmin only. One row per account that currently holds a live,
// non-revoked session — used to show who is logged in and let a SuperAdmin
// end their session.
export const getActiveSessions = withApiHandler(async () => {
  const res = await api.get("/auth/sessions/active");
  return res.data?.data || res.data || [];
});

// Re-fetch /auth/me to get fresh permissions.
// Call this on app mount and after any permission assignment.
export const refreshUser = async () => {
  try {
    const token = getStoredToken();
    if (!token) return null;
    const userRes = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let user = userRes.data?.data || userRes.data;
    user = mapUserToFrontend(user);
    if (user) {
      setStoredAuthData(token, user);
      return user;
    }
    return null;
  } catch {
    return null;
  }
};
