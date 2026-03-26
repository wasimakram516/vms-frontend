import api from "./api";
import axios from "axios";
import withApiHandler from "@/utils/withApiHandler";
import {
  getStoredToken,
  getStoredUser,
  setStoredAuthData,
  clearStoredAuthData,
} from "@/utils/authStorage";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const mapUserToFrontend = (user) => {
  if (!user || typeof user !== "object") return null;
  return {
    ...user,
    full_name: user.fullName || user.full_name || "User",
    staff_type: user.staffType || user.staff_type || null,
    name: user.fullName || user.full_name || user.name || "User",
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
  { showSuccess: true }
);

export const logout = async () => {
  try {
    await api.post("/auth/logout");
  } catch (err) {
    console.warn("Server logout failed or skipped", err);
  } finally {
    clearStoredAuthData();
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
  }
};

export const refreshToken = withApiHandler(async () => {
  const res = await api.post("/auth/refresh");
  const token = res.data?.accessToken || res.data?.data?.accessToken;
  if (token) setStoredAuthData(token, getStoredUser());
  return token;
});

