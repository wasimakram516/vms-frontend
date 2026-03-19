"use client";

const IS_BROWSER = typeof window !== "undefined";

export const getStoredToken = () => {
  if (!IS_BROWSER) return null;
  return localStorage.getItem("accessToken");
};

export const getStoredUser = () => {
  if (!IS_BROWSER) return null;
  const user = localStorage.getItem("user");
  try {
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

export const setStoredAuthData = (token, user) => {
  if (!IS_BROWSER) return;
  if (token) localStorage.setItem("accessToken", token);
  if (user) localStorage.setItem("user", JSON.stringify(user));
};

export const clearStoredAuthData = () => {
  if (!IS_BROWSER) return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
};
