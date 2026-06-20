"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { logout, refreshToken, refreshUser } from "@/services/authService";
import { getStoredUser, getStoredToken } from "@/utils/authStorage";
import { useSocket } from "@/contexts/SocketContext";

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

// Map a user object to its backend role-key (must mirror role-key.util.ts)
const getUserRoleKey = (user) => {
  if (!user) return null;
  if (user.role === "superadmin") return "__super__";
  if (user.role === "dev") return "__dev__";
  if (user.role === "admin") return `admin:${user.adminType || "departmental"}`;
  if (user.role === "staff") return `staff:${user.staffType}`;
  return user.role;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const { socket } = useSocket();
  const userRef = useRef(user);

  // Keep ref in sync so socket handlers always see the latest user without being in the dep array
  useEffect(() => { userRef.current = user; }, [user]);

  // Listen for permission change events emitted by the backend and refresh if they affect us
  useEffect(() => {
    if (!socket) return;

    const onRoleUpdated = ({ roleKey }) => {
      const current = userRef.current;
      if (!current) return;
      // superadmin/dev are never affected by role permission changes
      if (current.role === "superadmin" || current.role === "dev") return;
      if (getUserRoleKey(current) === roleKey) {
        refreshUser().then((fresh) => { if (fresh) setUser(fresh); });
      }
    };

    const onUserUpdated = ({ userId }) => {
      const current = userRef.current;
      if (current?.id === userId) {
        refreshUser().then((fresh) => { if (fresh) setUser(fresh); });
      }
    };

    const onResourcesUpdated = () => {
      // managedResources changed — everyone needs a fresh /auth/me
      refreshUser().then((fresh) => { if (fresh) setUser(fresh); });
    };

    socket.on("permissions:role-updated", onRoleUpdated);
    socket.on("permissions:user-updated", onUserUpdated);
    socket.on("permissions:resources-updated", onResourcesUpdated);

    return () => {
      socket.off("permissions:role-updated", onRoleUpdated);
      socket.off("permissions:user-updated", onUserUpdated);
      socket.off("permissions:resources-updated", onResourcesUpdated);
    };
  }, [socket]);

  // Load user on mount — show stored user immediately, no blocking on /auth/me
  useEffect(() => {
    const token = getStoredToken();
    const storedBusiness = typeof window !== "undefined" ? sessionStorage.getItem("selectedBusiness") : null;
    if (storedBusiness) setSelectedBusiness(storedBusiness);

    if (!token) {
      setLoading(false);
      return;
    }

    const storedUser = getStoredUser();
    if (storedUser) setUser(storedUser);
    setLoading(false);

    // Silently refresh from server in background so stale localStorage data catches up
    refreshUser().then((freshUser) => { if (freshUser) setUser(freshUser); });
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

  // Resume-from-sleep/lock/mobile minimize — token refresh only, no user refetch
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
