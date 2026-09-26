"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { logout, refreshToken, refreshUser } from "@/services/authService";
import { getStoredToken } from "@/utils/authStorage";
import { shouldRefreshAccessToken } from "@/utils/jwtTiming";
import { useSocket } from "@/contexts/SocketContext";

const AuthContext = createContext();

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
  const lastResumeCheckRef = useRef(0);

  // Keep ref in sync so socket handlers always see the latest user without being in the dep array
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Listen for permission change events emitted by the backend and refresh if they affect us
  useEffect(() => {
    if (!socket) return;

    const onRoleUpdated = ({ roleKey }) => {
      const current = userRef.current;
      if (!current) return;
      // superadmin/dev are never affected by role permission changes
      if (current.role === "superadmin" || current.role === "dev") return;
      if (getUserRoleKey(current) === roleKey) {
        refreshUser().then((fresh) => {
          if (fresh) setUser(fresh);
        });
      }
    };

    const onUserUpdated = ({ userId }) => {
      const current = userRef.current;
      if (current?.id === userId) {
        refreshUser().then((fresh) => {
          if (fresh) setUser(fresh);
        });
      }
    };

    socket.on("page-permissions:role-updated", onRoleUpdated);
    socket.on("page-permissions:user-updated", onUserUpdated);

    return () => {
      socket.off("page-permissions:role-updated", onRoleUpdated);
      socket.off("page-permissions:user-updated", onUserUpdated);
    };
  }, [socket]);

  // Load user on mount — show stored user immediately, no blocking on /auth/me
  useEffect(() => {
    const storedBusiness =
      typeof window !== "undefined"
        ? sessionStorage.getItem("selectedBusiness")
        : null;
    if (storedBusiness) setSelectedBusiness(storedBusiness);

    let active = true;
    const restoreSession = async () => {
      const token = await refreshToken();
      if (active && typeof token === "string") {
        const freshUser = await refreshUser();
        if (active && freshUser) setUser(freshUser);
      }
      if (active) setLoading(false);
    };
    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  // Proactive refresh loop. The threshold scales with the configured JWT
  // lifetime, so short-lived development tokens are not refreshed immediately.
  useEffect(() => {
    const interval = setInterval(async () => {
      const token = getStoredToken();
      if (!token) return;

      if (shouldRefreshAccessToken(token)) {
        await refreshToken();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Resume-from-sleep/lock/mobile minimize — token refresh only, no user refetch
  useEffect(() => {
    const onResume = async () => {
      if (document.visibilityState === "hidden") return;

      const now = Date.now();
      if (now - lastResumeCheckRef.current < 1000) return;
      lastResumeCheckRef.current = now;

      const token = getStoredToken();
      if (!token) return;

      if (shouldRefreshAccessToken(token, now)) {
        await refreshToken();
      }
    };

    window.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);

    return () => {
      window.removeEventListener("visibilitychange", onResume);
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
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
