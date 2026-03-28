"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { logout, refreshToken } from "@/services/authService";
import { getStoredUser, getStoredToken } from "@/utils/authStorage";

const AuthContext = createContext();

// Helper: decode JWT and return ms left until expiry
const getMsLeft = (token) => {
  try {
    const { exp } = JSON.parse(atob(token.split(".")[1]));
    return exp * 1000 - Date.now();
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = getStoredUser();
    const storedBusiness = typeof window !== "undefined" ? sessionStorage.getItem("selectedBusiness") : null;
    
    if (storedUser) {
      setUser(storedUser);
    }
    if (storedBusiness) {
      setSelectedBusiness(storedBusiness);
    }
    setLoading(false);
  }, []);

  // Proactive refresh loop (runs every 30s)
  useEffect(() => {
    const interval = setInterval(async () => {
      const token = getStoredToken();
      if (!token) return;

      const msLeft = getMsLeft(token);
      if (msLeft !== null && msLeft < 120000) {
        await refreshToken();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Resume-from-sleep/lock/mobile minimize refresh
  useEffect(() => {
    const onResume = async () => {
      const token = getStoredToken();
      if (!token) return;

      const msLeft = getMsLeft(token);
      if (msLeft !== null && msLeft < 120000) {
        await refreshToken();
      }
    };

    window.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);

    return () => {
      window.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
    };
  }, []);

  const handleSetUser = (userData) => {
    setUser(userData);
  };

  const handleSetSelectedBusiness = (businessSlug) => {
    if (typeof window !== "undefined") {
      if (businessSlug) {
        sessionStorage.setItem("selectedBusiness", businessSlug);
      } else {
        sessionStorage.removeItem("selectedBusiness");
      }
    }
    setSelectedBusiness(businessSlug);
  };

  const logoutAction = async (redirectTo) => {
    try {
      await logout(redirectTo);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      handleSetUser(null);
      handleSetSelectedBusiness(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser: handleSetUser,
        selectedBusiness,
        setSelectedBusiness: handleSetSelectedBusiness,
        logout: logoutAction,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
