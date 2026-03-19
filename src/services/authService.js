import api from "./api";
import axios from "axios";
import { 
  getStoredToken, 
  getStoredUser, 
  setStoredAuthData, 
  clearStoredAuthData 
} from "@/utils/authStorage";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

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
    user: getStoredUser() 
  };
};

export const login = async (email, password) => {
  try {
    const res = await api.post("/auth/login", { email, password });
    const accessToken = res.data?.accessToken || res.data?.data?.accessToken;

    if (!accessToken) {
      throw new Error("No access token received from server");
    }
    
    setStoredAuthData(accessToken, null);

    const userRes = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    let user = userRes.data?.data || userRes.data;
    user = mapUserToFrontend(user);

    if (!user) {
      throw new Error("Failed to fetch user profile after login");
    }

    setStoredAuthData(accessToken, user);

    return { token: accessToken, user };
  } catch (err) {
    console.error("Login service error:", err);

    if (err.response?.status !== 401) {
       clearStoredAuthData();
    }
    throw new Error(err.response?.data?.message || err.message || "Invalid credentials");
  }
};

export const verifySession = async () => {
  try {
    const currentToken = getStoredToken();
    if (!currentToken) {
      return null;
    }
    const res = await api.get("/auth/me");
    let user = res.data?.data || res.data;
    user = mapUserToFrontend(user);

    if (user && currentToken) {
      setStoredAuthData(currentToken, user);
      return { user };
    }
    return null;
  } catch (err) {
    console.error("Session verification failed:", err);
    clearStoredAuthData();
    return null;
  }
};

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

export const refreshToken = async () => {
  try {
    const res = await api.post("/auth/refresh");
    const token = res.data?.accessToken || res.data?.data?.accessToken;
    if (token) setStoredAuthData(token, getStoredUser());
    return token;
  } catch (err) {
    clearStoredAuthData();
    throw err;
  }
};

