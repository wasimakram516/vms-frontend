"use client";

import {
  Box,
  Typography,
  Button,
  Chip,
  Stack,
  Divider,
  Tabs,
  Tab,
  alpha,
  useTheme,
  useMediaQuery,
  CircularProgress,
  IconButton,
  Tooltip,
  Drawer,
  Badge,
} from "@mui/material";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import RoleGuard from "@/components/auth/RoleGuard";
import useSocket from "@/utils/useSocket";
import { getAllOrders, updateOrderStatus, updateOrderStatusSilent } from "@/services/kitchenService";
import { useMessage } from "@/contexts/MessageContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useColorMode } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import AppCard from "@/components/cards/AppCard";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const STATUS_CONFIG = {
  initiated: {
    label: "Initiated",
    icon: ICONS.info,
    chipColor: "secondary",
    dotColor: "#8B5CF6",
    next: { status: "received", label: "Mark Received", icon: ICONS.inbox },
  },
  received: {
    label: "Received",
    icon: ICONS.inbox,
    chipColor: "warning",
    dotColor: "#F97316",
    next: { status: "in_preparation", label: "Start Prep", icon: ICONS.restaurant },
  },
  in_preparation: {
    label: "Preparing",
    icon: ICONS.restaurant,
    chipColor: "info",
    dotColor: "#3B82F6",
    next: { status: "ready", label: "Mark Ready", icon: ICONS.checkCircle },
  },
  ready: {
    label: "Ready",
    icon: ICONS.checkCircle,
    chipColor: "success",
    dotColor: "#22C55E",
    next: { status: "delivered", label: "Mark Delivered", icon: ICONS.roomService },
  },
  delivered: {
    label: "Delivered",
    icon: ICONS.roomService,
    chipColor: "default",
    dotColor: "#6B7280",
    next: null,
  },
  cancelled: {
    label: "Cancelled",
    icon: ICONS.close,
    chipColor: "error",
    dotColor: "#EF4444",
    next: null,
  },
};

const ACTIVE_STATUSES = ["received", "in_preparation", "ready"];

function OrderCard({ order, onStatusUpdate, onCancel, updatingId, currentUser }) {
  const theme = useTheme();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
  const isUpdating = updatingId === order.id;
  const isRecent = dayjs().diff(dayjs(order.created_at), "minute") <= 15;

  return (
    <AppCard
      sx={{
        ...(isRecent && {
          borderColor: alpha(theme.palette.primary.main, 0.45),
          boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}, 0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
          animation: "cardEntrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
          "@keyframes cardEntrance": {
            from: { transform: "translateY(20px) scale(0.95)", opacity: 0 },
            to: { transform: "translateY(0) scale(1)", opacity: 1 },
          },
        }),
      }}
    >
      <Box
        sx={{
          height: 3,
          bgcolor: cfg.dotColor,
          opacity: isRecent ? 1 : 0.5,
        }}
      />

      <Box sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.3}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  color: "text.primary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {order.requester}
              </Typography>
              {isRecent && (
                <Chip
                  label="NEW"
                  size="small"
                  color="primary"
                  sx={{
                    height: 18,
                    fontSize: "0.58rem",
                    fontWeight: 900,
                    letterSpacing: 0.5,
                    borderRadius: 1,
                    animation: "pulse 2s infinite",
                    "@keyframes pulse": {
                      "0%, 100%": { opacity: 1 },
                      "50%": { opacity: 0.7 },
                    },
                  }}
                />
              )}
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <ICONS.time sx={{ fontSize: 11, color: "text.disabled" }} />
              <Typography sx={{ fontSize: "0.7rem", color: "text.disabled" }}>
                {dayjs(order.created_at).fromNow()}
              </Typography>
            </Stack>
          </Box>

          <Chip
            label={cfg.label}
            size="small"
            color={cfg.chipColor}
            variant="outlined"
            sx={{ fontSize: "0.65rem", fontWeight: 700, height: 22, flexShrink: 0 }}
          />
        </Stack>

        <Divider sx={{ mb: 1.5, borderStyle: "dashed", opacity: 0.5 }} />

        <Stack spacing={0.75} mb={2}>
          {order.items.map((item) => (
            <Stack
              key={item.id}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                px: 1.25,
                py: 0.6,
                borderRadius: 1.5,
                bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Box
                  sx={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    bgcolor: cfg.dotColor,
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontWeight: 500, fontSize: "0.82rem", color: "text.primary" }}>
                  {item.name}
                </Typography>
              </Stack>
              <Box
                sx={{
                  minWidth: 28,
                  height: 22,
                  borderRadius: 1,
                  bgcolor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "text.primary" }}>
                  ×{item.quantity}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>

        <Stack direction="row" spacing={1}>
          {cfg.next && (
            <Button
              fullWidth
              variant="contained"
              color={cfg.chipColor === "default" ? "inherit" : cfg.chipColor}
              size="small"
              disabled={isUpdating}
              startIcon={
                isUpdating
                  ? <CircularProgress size={14} color="inherit" />
                  : <cfg.next.icon sx={{ fontSize: 15 }} />
              }
              onClick={() => onStatusUpdate(order.id, cfg.next.status)}
              sx={{
                fontWeight: 700,
                textTransform: "none",
                py: 0.85,
                borderRadius: 2,
                fontSize: "0.8rem",
              }}
            >
              {isUpdating ? "Updating..." : cfg.next.label}
            </Button>
          )}
        </Stack>

        {!cfg.next && order.status === "delivered" && (
          <Box
            sx={{
              py: 0.85,
              textAlign: "center",
              borderRadius: 2,
              bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
            }}
          >
            <Typography sx={{ fontSize: "0.75rem", color: "text.disabled", fontWeight: 600 }}>
              ✓ Delivered
            </Typography>
          </Box>
        )}
      </Box>
    </AppCard>
  );
}

function EmptyColumn({ label }) {
  return (
    <Box
      sx={{
        py: 5,
        px: 2,
        textAlign: "center",
        border: "1.5px dashed",
        borderColor: "divider",
        borderRadius: 3,
        opacity: 0.5,
      }}
    >
      <ICONS.inbox sx={{ fontSize: 28, color: "text.disabled", mb: 1 }} />
      <Typography variant="caption" sx={{ fontWeight: 600, color: "text.disabled", display: "block" }}>
        No {label} orders
      </Typography>
    </Box>
  );
}

function ColumnHeader({ statusKey, count }) {
  const cfg = STATUS_CONFIG[statusKey];
  const theme = useTheme();
  const { mode } = useColorMode();
  const isDark = mode === "dark";

  return (
    <Box
      sx={{
        mb: 2,
        px: 1.5,
        py: 1.25,
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
        bgcolor: isDark ? "rgba(255,255,255,0.03)" : alpha(cfg.dotColor, 0.05),
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: 1.5,
            bgcolor: alpha(cfg.dotColor, 0.15),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <cfg.icon sx={{ fontSize: 16, color: cfg.dotColor }} />
        </Box>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: "0.8rem",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            color: "text.primary",
          }}
        >
          {cfg.label}
        </Typography>
      </Stack>
      <Chip
        label={count}
        size="small"
        sx={{
          height: 22,
          fontWeight: 800,
          fontSize: "0.72rem",
          bgcolor: count > 0 ? alpha(cfg.dotColor, 0.15) : "action.hover",
          color: count > 0 ? cfg.dotColor : "text.disabled",
          border: "none",
        }}
      />
    </Box>
  );
}

function KitchenDashboardContent() {
  const theme = useTheme();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { showMessage } = useMessage();
  const { hostSettings, loading: settingsLoading } = useSettings();
  const { user: currentUser } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModuleDisabled, setIsModuleDisabled] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioPrimed, setIsAudioPrimed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState(0); // 0 = Delivered, 1 = Cancelled
  const [historyNotificationCount, setHistoryNotificationCount] = useState(0);
  const audioRef = useRef(null);
  const cancelAudioRef = useRef(null);

  // Initialize Audio & Muted Preference
  useEffect(() => {
    const saved = localStorage.getItem("kitchen_is_muted");
    const muted = saved === "true";
    setIsMuted(muted);
    
    if (!audioRef.current) {
      audioRef.current = new Audio("/new-order-alert.mp3");
      audioRef.current.preload = "auto";
    }
    if (!cancelAudioRef.current) {
      cancelAudioRef.current = new Audio("/order-cancel-alert.wav");
      cancelAudioRef.current.preload = "auto";
    }
  }, []);

  const primeAudio = useCallback(async () => {
    if (isAudioPrimed || !audioRef.current || !cancelAudioRef.current) return false;

    try {
      // Browser requires a play attempt to enable the audio context
      await audioRef.current.play();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      await cancelAudioRef.current.play();
      cancelAudioRef.current.pause();
      cancelAudioRef.current.currentTime = 0;

      setIsAudioPrimed(true);
      return true;
    } catch (e) {
      console.log("Audio priming failed (likely no user interaction yet):", e);
      return false;
    }
  }, [isAudioPrimed]);

  // Global listener to auto-unlock on first interaction
  useEffect(() => {
    if (isAudioPrimed) return;

    const handleInteraction = async () => {
      const success = await primeAudio();
      if (success) {
        // Once primed, if user hasn't explicitly muted, we can unmute
        const saved = localStorage.getItem("kitchen_is_muted");
        if (saved !== "true") {
          setIsMuted(false);
        }
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

  const playAlert = () => {
    if (isMuted || !isAudioPrimed || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(e => console.error("Alert play failed:", e));
  };

  const playCancelAlert = () => {
    if (isMuted || !isAudioPrimed || !cancelAudioRef.current) return;
    cancelAudioRef.current.currentTime = 0;
    cancelAudioRef.current.play().catch(e => console.error("Cancel alert play failed:", e));
  };

  const toggleMute = async () => {
    if (!isAudioPrimed) {
      // First click on the button itself unlocks audio
      const success = await primeAudio();
      if (success) {
        setIsMuted(false);
        localStorage.setItem("kitchen_is_muted", "false");
      }
      return;
    }

    const newVal = !isMuted;
    setIsMuted(newVal);
    localStorage.setItem("kitchen_is_muted", String(newVal));
  };

  const fetchData = useCallback(async () => {
    const res = await getAllOrders();
    if (res?.error) {
      if (res.error === "Kitchen module is disabled" || res.message === "Kitchen module is disabled") {
        setIsModuleDisabled(true);
      }
    } else {
      setIsModuleDisabled(false);
      const all = Array.isArray(res) ? res : [];
      setOrders(all.filter((o) => 
        ACTIVE_STATUSES.includes(o.status) || 
        o.status === "cancelled" || 
        o.status === "delivered" ||
        o.status === "initiated"
      ));
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useSocket(
    useMemo(() => ({
      "kitchen-order:new": (newOrder) => {
        const mapped = mapOrder(newOrder);
        setOrders((prev) => [mapped, ...prev]);
        setLastUpdated(new Date());
        showMessage(`New order from ${mapped.requester}`, "info");
        playAlert();
        
        // Auto-receive new orders
        if (mapped.status === "initiated") {
          updateOrderStatusSilent(mapped.id, { status: "received" });
        }
      },
      "kitchen-order:updated": (updated) => {
        const mapped = mapOrder(updated);
        setOrders((prev) => {
          const isTerminal = mapped.status === "cancelled" || mapped.status === "delivered";
          if (!ACTIVE_STATUSES.includes(mapped.status) && !isTerminal && mapped.status !== "initiated") {
            return prev.filter((o) => o.id !== mapped.id);
          }
          const exists = prev.find((o) => o.id === mapped.id);
          return exists
            ? prev.map((o) => o.id === mapped.id ? mapped : o)
            : prev;
        });
        setLastUpdated(new Date());

        if (mapped.status === "cancelled") {
          playCancelAlert();
          showMessage(`Order from ${mapped.requester} has been cancelled`, "error");
          setHistoryNotificationCount(prev => prev + 1);
        }
      },
      host_settings_updated: () => {
        fetchData();
      },
    }), [showMessage, fetchData])
  );

  const mapOrder = (raw) => ({
    id: raw.id,
    status: raw.status,
    requester: raw.requesterUser?.fullName || raw.requester || "Staff",
    requesterId: raw.requesterUserId || raw.requesterId,
    is_new: raw.isNew ?? raw.is_new ?? false,
    items: (raw.items || []).map((item) => ({
      id: item.id,
      name: item.itemNameSnapshot || item.menuItem?.name || item.name || "Item",
      quantity: item.quantity,
    })),
    created_at: raw.createdAt || raw.created_at,
    updated_at: raw.updatedAt || raw.updated_at,
  });
  
  // Auto-receive effect for initial load
  useEffect(() => {
    if (loading || orders.length === 0) return;
    
    const initiatedOrders = orders.filter(o => o.status === "initiated");
    if (initiatedOrders.length > 0) {
      initiatedOrders.forEach(order => {
        updateOrderStatusSilent(order.id, { status: "received" });
      });
    }
  }, [orders, loading]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    const res = await updateOrderStatus(orderId, { status: newStatus });
    setUpdatingId(null);
    if (!res?.error) {
      setOrders((prev) => {
        const isTerminal = newStatus === "cancelled" || newStatus === "delivered";
        if (!ACTIVE_STATUSES.includes(newStatus) && !isTerminal && newStatus !== "initiated") {
          return prev.filter((o) => o.id !== orderId);
        }
        return prev.map((o) =>
          o.id === orderId ? { ...o, status: newStatus, is_new: false } : o
        );
      });
    }
  };

  const byStatus = (k) => orders.filter((o) => o.status === k);
  
  const cancelledOrders = orders.filter((o) => {
    if (o.status !== "cancelled") return false;
    const terminalAt = o.updated_at || o.created_at;
    return dayjs().diff(dayjs(terminalAt), "hour") < 24;
  });

  const deliveredOrders = orders.filter((o) => {
    if (o.status !== "delivered") return false;
    const terminalAt = o.updated_at || o.created_at;
    return dayjs().diff(dayjs(terminalAt), "hour") < 24;
  });

  const newCount = orders.filter(o => dayjs().diff(dayjs(o.created_at), "minute") <= 15).length;
  const totalActive = orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length;
  const tabStatuses = ACTIVE_STATUSES;

  if (loading || settingsLoading) return <LoadingState />;

  const isModuleOff = isModuleDisabled || (hostSettings && !hostSettings.isKitchenModuleEnabled);

  if (isModuleOff) {
    return (
      <Box sx={{ minHeight: "90vh", display: "flex", alignItems: "center", justifyContent: "center"}}>
        <Box sx={{ textAlign: "center", maxWidth: 450 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              bgcolor: "error.main",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 3,
              boxShadow: "0 8px 16px rgba(211, 47, 47, 0.2)"
            }}
          >
            <ICONS.diningTable sx={{ fontSize: 40 }} />
          </Box>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Kitchen Module Disabled
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ opacity: 0.8 }}>
            The staff kitchen module has been disabled system-wide. 
            Access to active orders and the dashboard is temporarily restricted.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>

      <Box
        sx={{
          bgcolor: isDark ? "rgba(255,255,255,0.03)" : "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
          px: { xs: 2, sm: 3, md: 4, lg: 5 },
          py: { xs: 2, md: 2.5 },
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2.5,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ICONS.restaurant sx={{ fontSize: 24, color: "primary.main" }} />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 900,
                    letterSpacing: "-0.5px",
                    fontFamily: "'Comfortaa', cursive",
                    color: "text.primary",
                    lineHeight: 1.2,
                  }}
                >
                  Kitchen Dashboard
                </Typography>
                
                <Tooltip 
                  title={
                    !isAudioPrimed 
                      ? "Unlock Audio Alerts" 
                      : isMuted 
                        ? "Unmute Alerts" 
                        : "Mute Alerts"
                  }
                >
                  <IconButton 
                    size="small"
                    onClick={toggleMute}
                    sx={{ 
                      width: 34,
                      height: 34,
                      bgcolor: (!isAudioPrimed || isMuted) ? alpha(theme.palette.error.main, 0.1) : alpha(theme.palette.primary.main, 0.1),
                      color: (!isAudioPrimed || isMuted) ? "error.main" : "primary.main",
                      borderRadius: 2,
                      border: !isAudioPrimed ? "2px solid" : "none",
                      borderColor: !isAudioPrimed ? "error.main" : "transparent",
                      animation: !isAudioPrimed ? "pulseShadow 2s infinite" : "none",
                      "@keyframes pulseShadow": {
                        "0%, 100%": { boxShadow: "0 0 0 0 rgba(211, 47, 47, 0.4)" },
                        "50%": { boxShadow: "0 0 0 8px rgba(211, 47, 47, 0)" }
                      },
                      "&:hover": {
                        bgcolor: (!isAudioPrimed || isMuted) ? alpha(theme.palette.error.main, 0.2) : alpha(theme.palette.primary.main, 0.2),
                      }
                    }}
                  >
                    {(!isAudioPrimed || isMuted) ? <ICONS.volumeOff sx={{ fontSize: 18 }} /> : <ICONS.volumeUp sx={{ fontSize: 18 }} />}
                  </IconButton>
                </Tooltip>

                <Tooltip title="View History">
                  <IconButton 
                    size="small"
                    onClick={() => {
                      setHistoryOpen(true);
                      setHistoryNotificationCount(0);
                    }}
                    sx={{ 
                      width: 34,
                      height: 34,
                      bgcolor: alpha(theme.palette.secondary.main, 0.1),
                      color: "secondary.main",
                      borderRadius: 2,
                      "&:hover": {
                        bgcolor: alpha(theme.palette.secondary.main, 0.2),
                      }
                    }}
                  >
                    <Badge badgeContent={historyNotificationCount} color="error" sx={{ "& .MuiBadge-badge": { fontSize: "0.65rem", height: 18, minWidth: 18, fontWeight: 900 } }}>
                      <ICONS.history sx={{ fontSize: 18 }} />
                    </Badge>
                  </IconButton>
                </Tooltip>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1} mt={0.5}>
                {lastUpdated && (
                  <Typography variant="caption" color="text.disabled" fontWeight={500}>
                    Updated {dayjs(lastUpdated).fromNow()}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, auto)" },
              gap: { xs: 1.5, md: 2 },
              width: { xs: "100%", md: "auto" },
            }}
          >
            {/* New Orders - Always Visible */}
            <Box
              sx={{
                px: 1.75,
                py: 1,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                border: "1px solid",
                borderColor: alpha(theme.palette.primary.main, 0.25),
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: "primary.main",
                  animation: newCount > 0 ? "pulse 2s infinite" : "none",
                  "@keyframes pulse": {
                    "0%, 100%": { transform: "scale(1)", opacity: 1 },
                    "50%": { transform: "scale(1.2)", opacity: 0.7 },
                  },
                  flexShrink: 0,
                  opacity: newCount > 0 ? 1 : 0.3,
                }}
              />
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "primary.main", flexGrow: 1 }}>
                New
              </Typography>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 900, color: "primary.main" }}>
                {newCount}
              </Typography>
            </Box>

            {ACTIVE_STATUSES.filter(k => k !== "initiated").map((k) => {
              const cfg = STATUS_CONFIG[k];
              const count = byStatus(k).length;
              return (
                <Box
                  key={k}
                  sx={{
                    px: 1.75,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                    border: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Box 
                    sx={{ 
                      width: 7, 
                      height: 7, 
                      borderRadius: "50%", 
                      bgcolor: cfg.dotColor, 
                      flexShrink: 0,
                      opacity: count > 0 ? 1 : 0.3 
                    }} 
                  />
                  <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", fontWeight: 600, whiteSpace: "nowrap", flexGrow: 1 }}>
                    {cfg.label}
                  </Typography>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "text.primary" }}>
                    {count}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 3, md: 4, lg: 5 }, py: { xs: 2, md: 3 } }}>
        {totalActive === 0 ? (
          <Box
            sx={{
              py: 10,
              textAlign: "center",
              border: "2px dashed",
              borderColor: "divider",
              borderRadius: 4,
              bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
            }}
          >
            <ICONS.restaurant sx={{ fontSize: 56, color: "text.disabled", mb: 2 }} />
            <Typography variant="h6" fontWeight={700} color="text.secondary" gutterBottom>
              No active orders
            </Typography>
            <Typography variant="body2" color="text.disabled">
              New orders will appear here in real time
            </Typography>
          </Box>
        ) : isMobile ? (
          // Mobile: Tabs
          <>
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              variant="fullWidth"
              sx={{
                mb: 2.5,
                bgcolor: "background.paper",
                borderRadius: 2.5,
                border: "1px solid",
                borderColor: "divider",
                minHeight: 44,
                "& .MuiTabs-indicator": { borderRadius: 2 },
              }}
            >
              {tabStatuses.map((k) => {
                const cfg = STATUS_CONFIG[k];
                const count = byStatus(k).length;
                return (
                  <Tab
                    key={k}
                    sx={{ minHeight: 44, textTransform: "none", fontWeight: 700, fontSize: "0.75rem" }}
                    label={
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700 }}>{cfg.label}</Typography>
                        {count > 0 && (
                          <Chip
                            label={count}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: "0.6rem",
                              fontWeight: 800,
                              bgcolor: alpha(cfg.dotColor, 0.15),
                              color: cfg.dotColor,
                            }}
                          />
                        )}
                      </Stack>
                    }
                  />
                );
              })}
            </Tabs>
            <Stack spacing={2}>
              {byStatus(tabStatuses[activeTab]).length === 0 ? (
                <EmptyColumn label={STATUS_CONFIG[tabStatuses[activeTab]].label} />
              ) : (
                byStatus(tabStatuses[activeTab]).map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusUpdate={handleStatusUpdate}
                    updatingId={updatingId}
                    currentUser={currentUser}
                  />
                ))
              )}
            </Stack>
          </>
        ) : (
          /* Desktop: Horizontal Scrollboard */
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${ACTIVE_STATUSES.length}, minmax(0, 1fr))`,
              pb: 3,
              gap: { sm: 2, md: 3 },
              px: { sm: 1, md: 0.5 },
              overflowX: "hidden",
              "&::-webkit-scrollbar": { height: 8 },
              "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
              "&::-webkit-scrollbar-thumb": { 
                bgcolor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                borderRadius: 4,
                "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)" }
              }
            }}
          >
            {ACTIVE_STATUSES.map((k) => (
              <Box key={k} sx={{ minHeight: "60vh" }}>
                <ColumnHeader statusKey={k} count={byStatus(k).length} />
                <Stack spacing={2}>
                  {byStatus(k).length === 0 ? (
                    <EmptyColumn label={STATUS_CONFIG[k].label} />
                  ) : (
                    byStatus(k).map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusUpdate={handleStatusUpdate}
                        updatingId={updatingId}
                        currentUser={currentUser}
                      />
                    ))
                  )}
                </Stack>
              </Box>
            ))}
          </Box>
        )}

        {/* History Drawer */}
        <Drawer
          anchor="right"
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          PaperProps={{
            sx: {
              width: { xs: "100%", sm: 420 },
              bgcolor: isDark ? "#121212" : "#f8fafc",
              borderLeft: "1px solid",
              borderColor: "divider",
              p: 0,
            }
          }}
        >
          <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ICONS.history sx={{ fontSize: 20, color: "secondary.main" }} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                    Order History
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Last 24 Hours
                  </Typography>
                </Box>
              </Stack>
              <IconButton onClick={() => setHistoryOpen(false)} size="small">
                <ICONS.close />
              </IconButton>
            </Stack>

            <Divider sx={{ mb: 3, borderStyle: "dashed" }} />

            <Box sx={{ mb: 1 }}>
              <Tabs
                value={historyTab}
                onChange={(_, val) => setHistoryTab(val)}
                variant="fullWidth"
                sx={{
                  minHeight: 40,
                  "& .MuiTab-root": {
                    py: 1.5,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "text.disabled",
                    "&.Mui-selected": { color: historyTab === 0 ? "success.main" : "error.main" }
                  },
                  "& .MuiTabs-indicator": {
                    bgcolor: historyTab === 0 ? "success.main" : "error.main"
                  }
                }}
              >
                <Tab label={`Delivered (${deliveredOrders.length})`} />
                <Tab label={`Cancelled (${cancelledOrders.length})`} />
              </Tabs>
            </Box>

            <Box sx={{ flexGrow: 1, overflowY: "auto", pr: 0.5, pt: 2 }}>
              {historyTab === 0 ? (
                /* Delivered Section */
                deliveredOrders.length === 0 ? (
                  <Box sx={{ py: 10, textAlign: "center", opacity: 0.5 }}>
                    <ICONS.roomService sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
                    <Typography variant="body2" fontWeight={600} color="text.disabled">
                      No delivered orders in the last 24h
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {deliveredOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusUpdate={handleStatusUpdate}
                        updatingId={updatingId}
                        currentUser={currentUser}
                      />
                    ))}
                  </Stack>
                )
              ) : (
                /* Cancelled Section */
                cancelledOrders.length === 0 ? (
                  <Box sx={{ py: 10, textAlign: "center", opacity: 0.5 }}>
                    <ICONS.close sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
                    <Typography variant="body2" fontWeight={600} color="text.disabled">
                      No cancelled orders in the last 24h
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {cancelledOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusUpdate={handleStatusUpdate}
                        updatingId={updatingId}
                        currentUser={currentUser}
                      />
                    ))}
                  </Stack>
                )
              )}
            </Box>

            <Box sx={{ pt: 3, mt: "auto" }}>
              <Button 
                fullWidth 
                variant="outlined" 
                onClick={() => setHistoryOpen(false)}
                sx={{ borderRadius: 2.5, fontWeight: 700, py: 1 }}
              >
                Close History
              </Button>
            </Box>
          </Box>
        </Drawer>
      </Box>

    </Box>
  );
}

export default function KitchenOrdersPage() {
  return (
    <RoleGuard allowedRoles={["staff"]} allowedStaffTypes={["kitchen"]}>
      <KitchenDashboardContent />
    </RoleGuard>
  );
}
