import api from "@/services/api";
import withApiHandler from "@/utils/withApiHandler";

// Store only access token, refresh token stays in cookies
export const getAccessToken = () => sessionStorage.getItem("accessToken");
export const setAccessToken = (accessToken) =>
  sessionStorage.setItem("accessToken", accessToken);
export const setUser = (user) =>
  sessionStorage.setItem("user", JSON.stringify(user));
export const clearTokens = () => {
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("user");
};

// Login API Call
// mock authentication system
export const login = async (email, password) => {
  console.log("Mock Login with:", email);
  
  // Hardcoded users
  const mockUsers = {
    "staff@sinan.com": { id: 1, name: "Gate Staff", email: "staff@sinan.com", role: "staff" },
    "admin@sinan.com": { id: 2, name: "Platform Admin", email: "admin@sinan.com", role: "admin" },
    "super@sinan.com": { id: 3, name: "Root Operator", email: "super@sinan.com", role: "superadmin" },
  };

  const user = mockUsers[email.toLowerCase()];
  
  if (user) {
    const data = {
      token: "mock-jwt-token-v1",
      user: user
    };
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  }
  
  throw new Error("Invalid credentials. Try staff@sinan.com or admin@sinan.com");
};

export const verifySession = async () => {
  const user = localStorage.getItem("user");
  if (user) return { user: JSON.parse(user) };
  return null;
};

export const logout = async () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

// Register is not needed for now
export const registerUser = async () => {
  return { success: true };
};

export const refreshToken = async () => {
  return "mock-jwt-token-v1";
};

export const logoutUser = async () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};
