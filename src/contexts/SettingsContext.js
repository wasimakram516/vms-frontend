"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { getHost, getHostForKitchen } from "@/services/hostService";
import { useAuth } from "@/contexts/AuthContext";
import useSocket from "@/utils/useSocket";

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const { user } = useAuth();
  const [hostSettings, setHostSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    if (!user) {
      setHostSettings(null);
      setLoading(false);
      return;
    }

    // Only SuperAdmin and Admin can access host settings
    if (user.role !== "superadmin" && user.role !== "admin") {
      setHostSettings(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const isKitchenAdmin = user.role === "admin" && user.adminType === "kitchen";
      const data = isKitchenAdmin ? await getHostForKitchen() : await getHost();
      setHostSettings(data);
    } catch (error) {
      console.error("Failed to fetch host settings:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Listen for real-time updates from server
  const socketEvents = useMemo(() => ({
    host_settings_updated: refreshSettings,
  }), [refreshSettings]);

  useSocket(socketEvents);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const value = {
    hostSettings,
    loading,
    refreshSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
