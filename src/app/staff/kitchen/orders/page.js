"use client";

import {
  Box,
  Typography,
  Button,
  Chip,
  Stack,
  Divider,
  Paper,
  Tabs,
  Tab,
  alpha,
  useTheme,
  useMediaQuery,
  CircularProgress,
} from "@mui/material";
import { useEffect, useState, useCallback, useMemo } from "react";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import RoleGuard from "@/components/auth/RoleGuard";
import useSocket from "@/utils/useSocket";
import { getAllOrders, updateOrderStatus } from "@/services/kitchenService";
import { useMessage } from "@/contexts/MessageContext";
import { useColorMode } from "@/contexts/ThemeContext";
import AppCard from "@/components/cards/AppCard";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const STATUS_CONFIG = {
  received: {
    label: "Received",
    icon: ICONS.inbox,
    chipColor: "warning",
    dotColor: "#F97316",
    next: { status: "in_preparation", label: "Start Prep", icon: ICONS.restaurant },
  },
  in_preparation: {
    label: "In Preparation",
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
};

const ACTIVE_STATUSES = ["received", "in_preparation", "ready"];

function OrderCard({ order, onStatusUpdate, updatingId }) {
  const theme = useTheme();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;
  const isUpdating = updatingId === order.id;

  return (
    <AppCard
      sx={{
        ...(order.is_new && {
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
          opacity: order.is_new ? 1 : 0.5,
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
              {order.is_new && (
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

        {!cfg.next && (
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
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "lg"));
  const { showMessage } = useMessage();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    const res = await getAllOrders();
    if (!res?.error) {
      const all = Array.isArray(res) ? res : [];
      setOrders(all.filter((o) => ACTIVE_STATUSES.includes(o.status)));
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
      },
      "kitchen-order:updated": (updated) => {
        const mapped = mapOrder(updated);
        setOrders((prev) => {
          if (!ACTIVE_STATUSES.includes(mapped.status)) {
            return prev.filter((o) => o.id !== mapped.id);
          }
          const exists = prev.find((o) => o.id === mapped.id);
          return exists
            ? prev.map((o) => o.id === mapped.id ? mapped : o)
            : prev;
        });
        setLastUpdated(new Date());
      },
    }), [showMessage])
  );

  const mapOrder = (raw) => ({
    id: raw.id,
    status: raw.status,
    requester: raw.requesterUser?.fullName || raw.requester || "Staff",
    is_new: raw.isNew ?? raw.is_new ?? false,
    items: (raw.items || []).map((item) => ({
      id: item.id,
      name: item.itemNameSnapshot || item.menuItem?.name || item.name || "Item",
      quantity: item.quantity,
    })),
    created_at: raw.createdAt || raw.created_at,
    updated_at: raw.updatedAt || raw.updated_at,
  });

  const handleStatusUpdate = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    const res = await updateOrderStatus(orderId, { status: newStatus });
    setUpdatingId(null);
    if (!res?.error) {
      setOrders((prev) => {
        if (!ACTIVE_STATUSES.includes(newStatus)) {
          return prev.filter((o) => o.id !== orderId);
        }
        return prev.map((o) =>
          o.id === orderId ? { ...o, status: newStatus, is_new: false } : o
        );
      });
    }
  };

  const byStatus = (k) => orders.filter((o) => o.status === k);
  const newCount = orders.filter((o) => o.is_new).length;
  const totalActive = orders.length;

  if (loading) return <LoadingState />;

  const tabStatuses = ACTIVE_STATUSES;

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
          <Stack direction="row" alignItems="center" spacing={2}>
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
            <Box>
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
              {lastUpdated && (
                <Typography variant="caption" color="text.disabled" fontWeight={500}>
                  Updated {dayjs(lastUpdated).fromNow()}
                </Typography>
              )}
            </Box>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, auto)" },
              gap: 1,
              width: { xs: "100%", sm: "auto" },
            }}
          >
            {newCount > 0 && (
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
                    animation: "pulse 1.5s infinite",
                    "@keyframes pulse": {
                      "0%, 100%": { transform: "scale(1)", opacity: 1 },
                      "50%": { transform: "scale(1.4)", opacity: 0.7 },
                    },
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "primary.main" }}>
                  {newCount} New
                </Typography>
              </Box>
            )}
            {ACTIVE_STATUSES.map((k) => {
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
                  <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: cfg.dotColor, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {cfg.label}
                  </Typography>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "text.primary", ml: "auto" }}>
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
                  />
                ))
              )}
            </Stack>
          </>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: isTablet
                ? "repeat(2, 1fr)"
                : "repeat(3, 1fr)",
              gap: { sm: 2.5, md: 3 },
              alignItems: "start",
            }}
          >
            {ACTIVE_STATUSES.map((k) => (
              <Box key={k}>
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
                      />
                    ))
                  )}
                </Stack>
              </Box>
            ))}
          </Box>
        )}
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
