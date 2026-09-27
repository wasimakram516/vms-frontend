"use client";

let accessToken = null;
let currentUser = null;
let refreshPromise = null;

if (typeof window !== "undefined") {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
}

const notifyAuthStorageChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("auth-storage-changed"));
};

export const getStoredToken = () => accessToken;

export const getStoredUser = () => currentUser;

export const setStoredAuthData = (token, user) => {
  if (token) accessToken = token;
  if (user) currentUser = user;
  notifyAuthStorageChanged();
};

export const clearStoredAuthData = () => {
  accessToken = null;
  currentUser = null;
  notifyAuthStorageChanged();
};

export const runSingleRefresh = (refresh) => {
  if (!refreshPromise) {
    refreshPromise = Promise.resolve()
      .then(refresh)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};
