"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { logout, verifySession } from "@/services/authService";
import { getStoredUser } from "@/utils/authStorage";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {

        const localUser = getStoredUser();
        if (localUser) {
          setUser(localUser);
        }

        const sessionData = await verifySession();
        if (sessionData) {
          setUser(sessionData.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedBusiness = sessionStorage.getItem("selectedBusiness");
      if (storedBusiness) {
        setSelectedBusiness(storedBusiness);
      }
    }
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

  const logoutAction = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
      handleSetSelectedBusiness(null);
      if (typeof window !== "undefined") {
        window.location.href = "/auth/login";
      }
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
