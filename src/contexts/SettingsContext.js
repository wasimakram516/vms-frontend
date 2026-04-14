"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { getHost } from "@/services/hostService";
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
      const data = await getHost();
      setHostSettings(data);
    } catch (error) {
      console.error("Failed to fetch host settings:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Listen for real-time updates from server
  const socketEvents = useMemo(() => ({
    host_settings_updated: (updatedData) => {
      if (updatedData) {
        const mapped = {
          id: updatedData.id,
          name: updatedData.name,
          email: updatedData.email,
          phone: updatedData.phone,
          address: updatedData.address,
          website: updatedData.website,
          logoUrl: updatedData.logoUrl,
          contactPersonName: updatedData.contactPersonName,
          contactPersonEmail: updatedData.contactPersonEmail,
          contactPersonPhone: updatedData.contactPersonPhone,
          isKitchenModuleEnabled: updatedData.isKitchenModuleEnabled,
          created_at: updatedData.createdAt,
          updated_at: updatedData.updatedAt,
        };
        setHostSettings(mapped);
      } else {
        refreshSettings();
      }
    }
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
