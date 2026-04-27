"use client";

import {
  Box,
  Typography,
  IconButton,
  Stack,
  CircularProgress,
  Divider,
  Chip,
  SwipeableDrawer,
  Dialog,
  DialogContent,
  DialogTitle,
  useMediaQuery,
  useTheme,
  Tabs,
  Tab,
  TextField,
  alpha,
  Collapse,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import dayjs from "dayjs";
import { DatePicker } from "@mui/x-date-pickers";
import { useKitchenNotifications } from "@/contexts/KitchenNotificationContext";
import ICONS from "@/utils/iconUtil";
import AppCard from "@/components/cards/AppCard";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import { getMyOrders, getAllOrders, cancelOrder, markOrdersAsSeen } from "@/services/kitchenService";
import { useMessage } from "@/contexts/MessageContext";
import isBetween from "dayjs/plugin/isBetween";
import useSocket from "@/utils/useSocket";

dayjs.extend(isBetween);

export default function OrderTrackingModal({ open, onClose, user }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isSuperAdmin = user?.role?.toLowerCase() === "superadmin";

  const [viewType, setViewType] = useState("my"); // 'my' or 'all'
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [idToCancel, setIdToCancel] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const { showMessage } = useMessage();
  const [sortOrder, setSortOrder] = useState("desc");
  const [requesterFilter, setRequesterFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sessionUnseenIds, setSessionUnseenIds] = useState(new Set());
  const hasCapturedInitialRef = useRef(false);

  const { markAllAsSeen, setIsTrackingOpen } = useKitchenNotifications();

  useEffect(() => {
    setIsTrackingOpen(open && viewType === "my");
    return () => setIsTrackingOpen(false);
  }, [open, viewType, setIsTrackingOpen]);

  const STATUS_OPTIONS = [
    { value: "all", label: "All Statuses" },
    { value: "initiated", label: "Initiated" },
    { value: "received", label: "Received" },
    { value: "in_preparation", label: "Preparing" },
    { value: "ready", label: "Ready" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const toggleOrderExpand = (orderId) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const fetchOrders = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const res = viewType === "all" && isSuperAdmin
        ? await getAllOrders({ date: selectedDate })
        : await getMyOrders(selectedDate);
      const all = Array.isArray(res) ? res : [];
      setOrders(all);

      // Mark as seen logic: ONLY for my orders AND only if "My Orders" tab is active
      if (open && viewType === "my" && all.length > 0 && user?.id) {
        const userIdStr = String(user.id);
        const myUnseen = all
          .filter(o => {
            const rid = String(o.requester_id || o.requesterUserId || "");
            const isMyOrder = rid === userIdStr;
            return !o.is_seen_by_requester && isMyOrder;
          })
          .map(o => o.id);
        
        if (myUnseen.length > 0) {
          setSessionUnseenIds(prev => {
            const next = new Set(prev);
            myUnseen.forEach(id => next.add(id));
            return next;
          });
          markOrdersAsSeen(); 
          markAllAsSeen(); 
        }
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, [open, viewType, selectedDate, isSuperAdmin, user?.id]);

  useEffect(() => {
    if (open) {
      hasCapturedInitialRef.current = false;
      setSessionUnseenIds(new Set());
      fetchOrders();
    }
  }, [open, fetchOrders]);

  useSocket(
    useMemo(() => ({
      "kitchen-order:new": () => open && fetchOrders(true),
      "kitchen-order:updated": () => open && fetchOrders(true),
    }), [fetchOrders, open])
  );

  const uniqueRequesters = useMemo(() => {
    const names = [...new Set(orders.map((o) => o.requester).filter(Boolean))];
    return names.sort();
  }, [orders]);

  // Count per person, filtered by current status selection
  const personCounts = useMemo(() => {
    const counts = {};
    orders.forEach((o) => {
      if (statusFilter === "all" || o.status === statusFilter) {
        counts[o.requester] = (counts[o.requester] || 0) + 1;
      }
    });
    return counts;
  }, [orders, statusFilter]);

  // Count per status, filtered by current requester selection
  const statusCounts = useMemo(() => {
    const counts = {};
    orders.forEach((o) => {
      const requesterMatch =
        viewType === "my" ||
        requesterFilter === "all" ||
        o.requester === requesterFilter;
      if (requesterMatch) {
        counts[o.status] = (counts[o.status] || 0) + 1;
      }
    });
    return counts;
  }, [orders, requesterFilter, viewType]);

  const clearFilters = () => {
    setSelectedDate(dayjs().format("YYYY-MM-DD"));
    setRequesterFilter("all");
    setStatusFilter("all");
    setSortOrder("desc");
  };

  const handleCancelOpen = (orderId) => {
    setIdToCancel(orderId);
    setCancelConfirmOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!idToCancel) return;
    
    setCancellingId(idToCancel);
    const res = await cancelOrder(idToCancel, "Cancelled by user via tracking modal");
    setCancellingId(null);
    setCancelConfirmOpen(false);
    setIdToCancel(null);
    
    if (!res?.error) {
      showMessage("Order cancelled successfully", "success");
      fetchOrders(true);
    }
  };

  const hasActiveFilters = useMemo(() => {
    return (
      selectedDate !== dayjs().format("YYYY-MM-DD") ||
      requesterFilter !== "all" ||
      statusFilter !== "all" ||
      sortOrder !== "desc"
    );
  }, [selectedDate, requesterFilter, statusFilter, sortOrder]);

  const displayedOrders = useMemo(() => {
    let result = [...orders];

    if (isSuperAdmin && viewType === "all" && requesterFilter !== "all") {
      result = result.filter((o) => o.requester === requesterFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }

    result.sort((a, b) => {
      const diff = new Date(a.created_at) - new Date(b.created_at);
      return sortOrder === "desc" ? -diff : diff;
    });

    return result;
  }, [orders, sortOrder, requesterFilter, statusFilter, isSuperAdmin, viewType]);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    const isToday = selectedDate === dayjs().format("YYYY-MM-DD");
    if (selectedDate) {
      chips.push({ key: "date", label: isToday ? "Today" : dayjs(selectedDate).format("MMM D, YYYY") });
    } else {
      chips.push({ key: "date", label: "All Time" });
    }
    if (statusFilter !== "all") {
      const found = STATUS_OPTIONS.find((o) => o.value === statusFilter);
      if (found) chips.push({ key: "status", label: found.label });
    }
    if (isSuperAdmin && viewType === "all" && requesterFilter !== "all") {
      chips.push({ key: "person", label: requesterFilter });
    }
    if (sortOrder === "asc") chips.push({ key: "sort", label: "Oldest First" });
    return chips;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, statusFilter, requesterFilter, sortOrder, isSuperAdmin, viewType]);

  const Content = (
    <Box sx={{
      p: isMobile ? "0 20px 20px 20px" : 0,
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden"
    }}>
      {/* Header for Drawer (small Screen) */}
      {isMobile && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 2, flexShrink: 0 }}>
          <Typography variant="h6" fontWeight="900">Order Tracking</Typography>
          <IconButton onClick={onClose}><ICONS.close /></IconButton>
        </Stack>
      )}

      {/* Super Admin: My / All tabs — always visible */}
      {isSuperAdmin && (
        <Box sx={{ mb: 1.5, mt: 0, flexShrink: 0 }}>
          <Tabs
            value={viewType}
            onChange={(_, v) => setViewType(v)}
            variant="fullWidth"
            sx={{
              bgcolor: "action.hover",
              borderRadius: 2,
              minHeight: 40,
              "& .MuiTabs-indicator": { height: "100%", borderRadius: 1.5, zIndex: 0, bgcolor: alpha(theme.palette.primary.main, 0.1) },
              "& .MuiTab-root": { minHeight: 40, zIndex: 1, textTransform: "none", fontWeight: 700, fontSize: "0.8rem" }
            }}
          >
            <Tab value="my" label="My Orders" />
            <Tab value="all" label="All Orders" />
          </Tabs>
        </Box>
      )}

      {/* Collapsible Filter Panel */}
      <Box sx={{ flexShrink: 0 }}>
        {/* Filter toggle header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          onClick={() => setFiltersOpen((v) => !v)}
          sx={{
            cursor: "pointer",
            mb: filtersOpen ? 1 : 0,
            px: 1,
            py: 0.5,
            borderRadius: 2,
            userSelect: "none",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <ICONS.filter sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                Filters
              </Typography>
            </Stack>
            {!filtersOpen && activeFilterChips.map((chip) => (
              <Chip
                key={chip.key}
                label={chip.label}
                size="small"
                sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
              />
            ))}
            <Box sx={{ flexGrow: 1 }} />
            {hasActiveFilters && (
              <Button
                size="small"
                variant="text"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFilters();
                }}
                sx={{
                  minWidth: 0,
                  p: "0 8px",
                  height: 20,
                  fontSize: "0.6rem",
                  fontWeight: 800,
                  color: "error.main",
                  mr: 1,
                  "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.1) },
                }}
              >
                CLEAR ALL
              </Button>
            )}
          </Stack>
          <ICONS.chevronRight
            sx={{
              fontSize: 18,
              color: "text.secondary",
              transform: filtersOpen ? "rotate(90deg)" : "none",
              transition: "transform 0.2s",
              flexShrink: 0,
            }}
          />
        </Stack>

        {/* Collapsible filter controls */}
        <Collapse in={filtersOpen}>
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <DatePicker
                label="Order Placement Date"
                value={selectedDate ? dayjs(selectedDate) : null}
                onChange={(val) => setSelectedDate(val ? val.format("YYYY-MM-DD") : null)}
                minDate={dayjs("2020-01-01")}
                maxDate={dayjs("2099-12-31")}
                format="DD MMM YYYY"
                slotProps={{
                  textField: { 
                    size: "small", 
                    fullWidth: true, 
                    InputProps: { sx: { borderRadius: 2 } },
                    placeholder: "All Dates"
                  },
                  field: { clearable: true }
                }}
              />
              <FormControl size="small" sx={{ minWidth: 140, flexShrink: 0 }}>
                <InputLabel>Sort</InputLabel>
                <Select
                  value={sortOrder}
                  label="Sort"
                  onChange={(e) => setSortOrder(e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="desc">Latest First</MenuItem>
                  <MenuItem value="asc">Oldest First</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            {/* Super Admin: Requester filter (only in All Orders view) */}
            {isSuperAdmin && viewType === "all" && uniqueRequesters.length > 0 && (
              <FormControl size="small" fullWidth>
                <InputLabel>Filter by Person</InputLabel>
                <Select
                  value={requesterFilter}
                  label="Filter by Person"
                  onChange={(e) => setRequesterFilter(e.target.value)}
                  renderValue={(val) => val === "all" ? "All People" : val}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="all">
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: "100%" }}>
                      <Typography variant="body2" fontWeight={700}>All People</Typography>
                      <Chip
                        label={
                          statusFilter === "all"
                            ? orders.length
                            : orders.filter((o) => o.status === statusFilter).length
                        }
                        size="small"
                        sx={{ height: 18, fontSize: "0.6rem", fontWeight: 800 }}
                      />
                    </Stack>
                  </MenuItem>
                  {uniqueRequesters.map((name) => (
                    <MenuItem key={name} value={name}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: "100%" }}>
                        <Typography variant="body2" color={personCounts[name] > 0 ? "text.primary" : "text.disabled"}>
                          {name}
                        </Typography>
                        <Chip
                          label={personCounts[name] || 0}
                          size="small"
                          disabled={!personCounts[name]}
                          sx={{ height: 18, fontSize: "0.6rem", fontWeight: 800 }}
                        />
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Status filter — available to all roles */}
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
                renderValue={(val) => {
                  const found = STATUS_OPTIONS.find((o) => o.value === val);
                  return found ? found.label : val;
                }}
                sx={{ borderRadius: 2 }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: "100%" }}>
                      <Typography variant="body2" color={opt.value === "all" || statusCounts[opt.value] > 0 ? "text.primary" : "text.disabled"}>
                        {opt.label}
                      </Typography>
                      <Chip
                        label={
                          opt.value === "all"
                            ? (Object.values(statusCounts).reduce((a, b) => a + b, 0))
                            : (statusCounts[opt.value] || 0)
                        }
                        size="small"
                        disabled={opt.value !== "all" && !statusCounts[opt.value]}
                        sx={{ height: 18, fontSize: "0.6rem", fontWeight: 800 }}
                      />
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Collapse>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Result count */}
      {!loading && orders.length > 0 && (
        <Typography variant="caption" color="text.disabled" fontWeight={700} sx={{ mb: 1.5, flexShrink: 0, display: "block" }}>
          Showing {displayedOrders.length} of {orders.length} order{orders.length !== 1 ? "s" : ""}
          {sortOrder === "desc" ? " · Latest first" : " · Oldest first"}
        </Typography>
      )}

      {/* Orders List */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", minHeight: 0, pr: 0.5 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        ) : displayedOrders.length === 0 ? (
          <Box sx={{ py: 6, textAlign: "center", opacity: 0.5 }}>
            <ICONS.history sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="body2" fontWeight="600">
              {orders.length > 0 ? "No orders match the selected filter" : "No orders found for this date"}
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {displayedOrders.map((order) => {
              const sortedHistory = [...(order.status_history || [])].sort(
                (a, b) => new Date(a.changed_at) - new Date(b.changed_at)
              );

              return (
                <AppCard key={order.id} sx={{ p: 2, bgcolor: "action.hover", border: "1px solid", borderColor: "divider" }}>
                  <Box sx={{ mb: 1.5 }}>
                    <Stack 
                      direction="row" 
                      justifyContent="space-between" 
                      alignItems="center" 
                      sx={{ mb: isMobile ? 1 : 0 }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        <Chip
                          label={order.status.replace("_", " ")}
                          color={
                            order.status === "initiated" ? "secondary" :
                            order.status === "received" ? "warning" :
                            order.status === "in_preparation" ? "info" :
                            order.status === "ready" ? "success" : 
                            order.status === "cancelled" ? "error" : "default"
                          }
                          size="small"
                          sx={{ fontWeight: "900", textTransform: "uppercase", fontSize: "0.6rem", height: 20 }}
                        />
                        <Typography 
                          sx={{ 
                            fontSize: "0.7rem", 
                            fontWeight: 700, 
                            color: "text.secondary",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: isMobile ? 120 : "none"
                          }}
                        >
                          • {order.requester}
                        </Typography>
                      </Stack>
                      
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: "0.65rem" }}>
                          {dayjs(order.created_at).format("h:mm A")}
                        </Typography>
                        {sessionUnseenIds.has(order.id) && (
                          <Box 
                            sx={{ 
                              width: 6, 
                              height: 6, 
                              borderRadius: "50%", 
                              bgcolor: "#22c55e", 
                              boxShadow: "0 0 8px rgba(34, 197, 94, 0.4)"
                            }} 
                          />
                        )}
                      </Stack>
                    </Stack>

                    {order.visitor_name && (
                      <Box sx={{ mt: isMobile ? 0.5 : 0.25 }}>
                        <Chip 
                          label={`For: ${order.visitor_name}${order.visitor_organisation ? ` (${order.visitor_organisation})` : ""}`} 
                          size="small" 
                          variant="outlined" 
                          sx={{ 
                            height: 18, 
                            fontSize: "0.6rem", 
                            fontWeight: 800, 
                            borderStyle: "dashed", 
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                            maxWidth: "100%",
                            "& .MuiChip-label": { px: 1 }
                          }} 
                        />
                      </Box>
                    )}
                  </Box>
                  <style>
                    {`
                      @keyframes pulseDot {
                        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
                        70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
                        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
                      }
                    `}
                  </style>

                  <Box sx={{ mb: 2, pl: 0.5 }}>
                    {order.items?.map((item, idx) => (
                      <Typography key={`item-${item.id}-${idx}`} variant="body2" fontWeight="700" sx={{ fontSize: "0.85rem" }}>
                        {item.quantity}× {item.name}
                      </Typography>
                    ))}
                  </Box>

                  {/* Timeline (Expandable) */}
                  {sortedHistory.length > 0 && (
                    <Box sx={{ pt: 1, borderTop: "1px dashed", borderColor: "divider" }}>
                      <Button
                        size="small"
                        onClick={() => toggleOrderExpand(order.id)}
                        endIcon={<ICONS.chevronRight sx={{
                          transform: expandedOrders.has(order.id) ? "rotate(90deg)" : "none",
                          transition: "0.2s"
                        }} />}
                        sx={{
                          textTransform: "none",
                          p: 0,
                          color: "text.secondary",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          "&:hover": { bgcolor: "transparent", color: "primary.main" }
                        }}
                      >
                        Order Timeline
                      </Button>

                      <Collapse in={expandedOrders.has(order.id)}>
                        <Box sx={{ pl: 0.5, pt: 2 }}>
                          {sortedHistory.map((h, i) => (
                            <Box key={`hist-${h.id}`} sx={{ display: "flex", gap: 1.5, mb: i < sortedHistory.length - 1 ? 1.5 : 0 }}>
                              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 0.5 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: i === sortedHistory.length - 1 ? "primary.main" : "text.disabled", flexShrink: 0 }} />
                                {i < sortedHistory.length - 1 && (
                                  <Box sx={{ width: 1.5, flex: 1, bgcolor: "divider", mt: 0.5, minHeight: 12 }} />
                                )}
                              </Box>
                              <Box>
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                  <Typography variant="caption" fontWeight="700" sx={{ textTransform: "capitalize", color: i === sortedHistory.length - 1 ? "text.primary" : "text.secondary" }}>
                                    {h.status.replace("_", " ")}
                                  </Typography>
                                  <Typography sx={{ fontSize: "0.6rem", color: "text.disabled" }}>
                                    {dayjs(h.changed_at).format("MMM D, YYYY - h:mm A")}
                                  </Typography>
                                  {h.changed_by && (
                                    <Chip
                                      label={h.changed_by}
                                      size="small"
                                      variant="outlined"
                                      sx={{
                                        height: 16,
                                        fontSize: "0.55rem",
                                        fontWeight: 700,
                                        borderStyle: "dashed",
                                        bgcolor: alpha(theme.palette.primary.main, 0.05)
                                      }}
                                    />
                                  )}
                                </Stack>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      </Collapse>
                    </Box>
                  )}

                  {/* Cancel Action for Requester/SuperAdmin */}
                  {(order.status === "initiated" || order.status === "received") && 
                   (isSuperAdmin || user?.id === order.requester_id) && (
                    <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
                      <Button
                        fullWidth
                        size="small"
                        color="error"
                        variant="outlined"
                        disabled={cancellingId === order.id}
                        startIcon={cancellingId === order.id ? <CircularProgress size={14} /> : <ICONS.close />}
                        onClick={() => handleCancelOpen(order.id)}
                        sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none", fontSize: "0.78rem" }}
                      >
                        {cancellingId === order.id ? "Cancelling..." : "Cancel Order"}
                      </Button>
                    </Box>
                  )}
                </AppCard>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Global Confirmation Dialog */}
      <ConfirmationDialog
        open={cancelConfirmOpen}
        onClose={() => { setCancelConfirmOpen(false); setIdToCancel(null); }}
        onConfirm={handleCancelConfirm}
        title="Cancel Kitchen Order"
        message="Are you sure you want to cancel this order? This action cannot be undone once confirmed."
        confirmButtonText="Confirm"
        confirmButtonIcon={<ICONS.close />}
        confirmButtonColor="error"
      />
    </Box>
  );

  if (isMobile) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        onOpen={() => {}}
        PaperProps={{
          sx: {
            borderRadius: "24px 24px 0 0",
            height: "90vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }
        }}
      >
        <Box sx={{ width: "100%", height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Box sx={{ width: 36, height: 4, bgcolor: "divider", borderRadius: 2 }} />
        </Box>
        {Content}
      </SwipeableDrawer>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: { borderRadius: 4, height: "85vh" }
      }}
    >
      <DialogTitle sx={{ p: 2.5, pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight="900">Order Tracking</Typography>
          <IconButton onClick={onClose} size="small"><ICONS.close /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 2.5, pt: 1 }}>
        {Content}
      </DialogContent>
    </Dialog>
  );
}
