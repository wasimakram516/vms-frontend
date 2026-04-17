"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMessage } from "@/contexts/MessageContext";
import useSocket from "@/utils/useSocket";
import { getMyOrders } from "@/services/kitchenService";

const KitchenNotificationContext = createContext();

export const KitchenNotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const { showMessage } = useMessage();
  const [unseenIds, setUnseenIds] = useState(new Set());
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioPrimed, setIsAudioPrimed] = useState(false);
  const statusAudioRef = useRef(null);
  
  const unseenCount = useMemo(() => unseenIds.size, [unseenIds]);

  // Initialize and check persistent preferences
  useEffect(() => {
    const savedMute = localStorage.getItem("kitchen_cms_muted");
    if (savedMute !== null) {
      setIsMuted(savedMute === "true");
    }

    if (!statusAudioRef.current) {
      statusAudioRef.current = new Audio("/order-status-update.mp3");
      statusAudioRef.current.preload = "auto";
    }
  }, []);

  const primeAudio = useCallback(async () => {
    if (isAudioPrimed || !statusAudioRef.current) return false;
    try {
      await statusAudioRef.current.play();
      statusAudioRef.current.pause();
      statusAudioRef.current.currentTime = 0;
      setIsAudioPrimed(true);
      return true;
    } catch (e) {
      console.log("Audio priming failed:", e);
      return false;
    }
  }, [isAudioPrimed]);

  const playAlert = useCallback(() => {
    if (isMuted || !isAudioPrimed || !statusAudioRef.current) return;
    statusAudioRef.current.currentTime = 0;
    statusAudioRef.current.play().catch(e => console.error("Kitchen alert play failed:", e));
  }, [isAudioPrimed, isMuted]);

  const fetchInitialUnseen = useCallback(async () => {
    if (!user || user.role === "dev") return;
    try {
      const orders = await getMyOrders();
      if (Array.isArray(orders)) {
        const ids = orders.filter(o => !o.is_seen_by_requester).map(o => o.id);
        setUnseenIds(new Set(ids));
      }
    } catch (e) {
      console.error("Failed to fetch initial unseen orders:", e);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchInitialUnseen();
    } else {
      setUnseenIds(new Set());
    }
  }, [user, fetchInitialUnseen]);

  // Global interaction listener for priming
  useEffect(() => {
    if (isAudioPrimed) return;
    const handleInteraction = async () => {
      const success = await primeAudio();
      if (success) {
        const saved = localStorage.getItem("kitchen_cms_muted");
        if (saved !== "true") setIsMuted(false);
        window.removeEventListener("click", handleInteraction);
        window.removeEventListener("keydown", handleInteraction);
      }
    };
    window.addEventListener("click", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [isAudioPrimed, primeAudio]);

  const socketEvents = useMemo(() => ({
    "kitchen-order:updated": (order) => {
      if (user?.role === "dev") return;
      const isMyOrder = order.requester_id === user?.id || order.requesterUserId === user?.id;
      // Only notify if someone else updated it
      const isUnseen = order.is_seen_by_requester === false || order.isSeenByRequester === false;
      
      if (isMyOrder && isUnseen) {
        setUnseenIds(prev => {
          const next = new Set(prev);
          next.add(order.id);
          return next;
        });
        
        playAlert();
        
        const statusLabel = (order.status || "updated").replace("_", " ").toUpperCase();
        if (order.status === "cancelled") {
          const cancelBy = order.updated_by_user || order.updatedBy?.fullName || "Kitchen Staff";
          showMessage(`${cancelBy} cancelled your order`, "error");
        } else {
          showMessage(`Your order status is now ${statusLabel}`, "info");
        }
      }
    }
  }), [user?.id, playAlert, showMessage]);

  useSocket(socketEvents);

  const toggleMute = async () => {
    if (!isAudioPrimed) {
      const success = await primeAudio();
      if (success) {
        setIsMuted(false);
        localStorage.setItem("kitchen_cms_muted", "false");
      }
    } else {
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      localStorage.setItem("kitchen_cms_muted", nextMuted ? "true" : "false");
    }
  };

  const markAllAsSeen = () => {
    setUnseenIds(new Set());
  };

  const value = {
    unseenCount,
    isMuted,
    isAudioPrimed,
    toggleMute,
    markAllAsSeen,
  };

  return (
    <KitchenNotificationContext.Provider value={value}>
      {children}
    </KitchenNotificationContext.Provider>
  );
};

export const useKitchenNotifications = () => {
  const context = useContext(KitchenNotificationContext);
  if (!context) {
    throw new Error("useKitchenNotifications must be used within a KitchenNotificationProvider");
  }
  return context;
};
