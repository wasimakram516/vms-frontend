"use client";

import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Stack,
  CircularProgress,
  Divider,
  Badge,
  Chip,
  Drawer,
  SwipeableDrawer,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  useMediaQuery,
  useTheme,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Pagination,
  Tooltip,
  Autocomplete,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from "@mui/material";
import { useEffect, useState, useMemo, useCallback } from "react";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import AppCard from "@/components/cards/AppCard";
import ListToolbar from "@/components/ListToolbar";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useSocket } from "@/contexts/SocketContext";
import { useMessage } from "@/contexts/MessageContext";
import { useKitchenNotifications } from "@/contexts/KitchenNotificationContext";
import { getActiveMenuItems, createOrder, getMyOrders, markOrdersAsSeen } from "@/services/kitchenService";
import { getRegistrations, mapRegistration } from "@/services/registrationService";
import { useRef } from "react";
import OrderTrackingModal from "./OrderTrackingModal";

const getRegistrationUserKey = (registration) => {
  return (
    registration?.userId
    || registration?.user?.id
    || registration?.id
  );
};

const visitorOptionFallbackKeys = new WeakMap();
let visitorOptionFallbackCounter = 0;

const getVisitorOptionKey = (registration) => {
  if (!registration) return "visitor:null";
  if (registration.id) return `registration:${registration.id}`;

  const stableIdentity = registration.userId || registration.user?.id || registration.createdAt || registration.created_at;
  if (stableIdentity) return `identity:${stableIdentity}`;

  if (!visitorOptionFallbackKeys.has(registration)) {
    visitorOptionFallbackCounter += 1;
    visitorOptionFallbackKeys.set(registration, `fallback:${visitorOptionFallbackCounter}`);
  }

  return visitorOptionFallbackKeys.get(registration);
};

const getLatestCheckedInVisitors = (registrations) => {
  const latestByUser = new Map();

  for (const registration of Array.isArray(registrations) ? registrations : []) {
    const userKey = getRegistrationUserKey(registration);
    if (!userKey || latestByUser.has(userKey)) continue;
    latestByUser.set(userKey, registration);
  }

  return Array.from(latestByUser.values()).filter((registration) => registration?.status === "checked_in");
};

function OrderingContent() {
  const { user } = useAuth();
  const { hostSettings, loading: settingsLoading } = useSettings();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModuleDisabled, setIsModuleDisabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const [page, setPage] = useState(0);

  const [resList, setResList] = useState([]);
  const [resLoading, setResLoading] = useState(false);
  const [resHasLoadedOnce, setResHasLoadedOnce] = useState(false);
  const [isResListRefreshing, setIsResListRefreshing] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState(null);

  const [cart, setCart] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  
  const { on } = useSocket();
  const { 
    unseenCount, 
    isMuted, 
    isAudioPrimed, 
    toggleMute 
  } = useKitchenNotifications();
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const menuRes = await getActiveMenuItems();
      if (menuRes?.error === "Kitchen module is disabled" || menuRes?.message === "Kitchen module is disabled") {
        setIsModuleDisabled(true);
      } else {
        setIsModuleDisabled(false);
        setItems(Array.isArray(menuRes) ? menuRes : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedCart = localStorage.getItem("kitchen_cart");
    
    if (savedCart) {
      try { setCart(JSON.parse(savedCart)); } catch (e) { console.error(e); }
    }

    fetchData().finally(() => setIsReady(true));
    fetchCheckedInRegistrations();

    const unsubUpdate = on("registration:updated", (updatedReg) => {
      if (!updatedReg?.id) return;
      const mappedReg = mapRegistration(updatedReg);
      setResList((prev) => {
        const updated = prev.map((r) => (r.id === mappedReg.id ? mappedReg : r)).filter((r) => r?.status === "checked_in");
        return updated.length > 0 ? updated : prev.filter((r) => r?.status === "checked_in");
      });
      
      // Auto-clear selection if the selected visitor is no longer checked in
      setSelectedVisitor(prev => {
        if (prev?.id === updatedReg.id && updatedReg.status !== "checked_in") {
          return null;
        }
        return prev;
      });
    });

    const unsubNew = on("registration:new", (newReg) => {
      if (!newReg?.id || newReg.status !== "checked_in") return;
      setResList((prev) => {
        const exists = prev.some((r) => r.id === newReg.id);
        return exists ? prev.map((r) => (r.id === newReg.id ? { ...r, ...newReg } : r)) : [newReg, ...prev];
      });
    });

    return () => {
      unsubUpdate?.();
      unsubNew?.();
    };
  }, [on]);

  const fetchCheckedInRegistrations = useCallback(async ({ silent = false } = {}) => {
    const shouldShowFullLoader = !silent && !resHasLoadedOnce && resList.length === 0;
    if (shouldShowFullLoader) setResLoading(true);
    else if (!silent) setIsResListRefreshing(true);
    try {
      const res = await getRegistrations();
      setResList(getLatestCheckedInVisitors(res));
      setResHasLoadedOnce(true);
    } finally {
      if (shouldShowFullLoader) setResLoading(false);
      if (!silent) setIsResListRefreshing(false);
    }
  }, [resHasLoadedOnce, resList.length]);

  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem("kitchen_cart", JSON.stringify(cart));
  }, [cart, isReady]);

  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const pagedItems = useMemo(() => {
    return filteredItems.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

  const cartItemsLists = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const item = items.find((i) => i.id === id);
        if (!item) return null; // Filter out deleted items
        return { ...item, quantity: qty };
      })
      .filter(item => item !== null);
  }, [cart, items]);

  const updateQuantity = (itemId, delta) => {
    setCart((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      const newCart = { ...prev };
      if (next === 0) {
        delete newCart[itemId];
      } else {
        newCart[itemId] = next;
      }
      return newCart;
    });
  };

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (cartOpen && totalItems === 0) {
      setCartOpen(false);
    }
  }, [totalItems, cartOpen]);

  const handlePlaceOrder = async (force = false) => {
    setSubmitting(true);
    try {
      const orderItems = Object.entries(cart).map(([itemId, quantity]) => ({
        menuItemId: itemId,
        quantity,
      }));

      const payload = {
        items: orderItems,
        registrationId: selectedVisitor?.id || undefined,
        visitorId: selectedVisitor?.userId || undefined,
      };

      const res = await createOrder(payload, force);

      if (res && res.status === 409) {
        setPendingOrder(payload);
        setDuplicateDialog(true);
        return;
      }

      if (res && !res.error) {
        setCart({});
        setSelectedVisitor(null);
        setCartOpen(false);
        setDuplicateDialog(false);
        setPendingOrder(null);
        localStorage.removeItem("kitchen_cart");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDuplicate = () => {
    handlePlaceOrder(true);
  };

  if (loading) return <LoadingState />;

  const toggleCart = (open) => () => {
    setCartOpen(open);
  };

  const SummaryContent = (
    <Box sx={{ 
      p: isMobile ? "24px 24px 48px 24px" : 3, 
      display: "flex", 
      flexDirection: "column", 
      height: "100%",
      overflow: "hidden" 
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexShrink: 0 }}>
        <Typography variant="h6" fontWeight="900">Order Details</Typography>
        <IconButton onClick={toggleCart(false)}><ICONS.close /></IconButton>
      </Stack>

      <Box sx={{ mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 3, border: "1px solid", borderColor: "divider", flexShrink: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, mb: 1, display: "block" }}>
          ATTACHED VISITOR (OPTIONAL)
        </Typography>
        {isResListRefreshing && !resLoading && (
          <LinearProgress
            sx={{
              mb: 1.5,
              borderRadius: 2,
              height: 3,
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.12),
            }}
          />
        )}
        <Autocomplete
          size="small"
          options={resList}
          loading={resLoading}
          isOptionEqualToValue={(option, value) => getVisitorOptionKey(option) === getVisitorOptionKey(value)}
          getOptionLabel={(option) => {
            const name = option.user?.fullName || option.full_name || "Visitor";
            const org = option.organisation || option.companyName || "";
            return `${name} (${org})`;
          }}
          renderOption={(props, option) => {
            const { key: _muiKey, ...rest } = props;
            return <li {...rest} key={String(getVisitorOptionKey(option))}>{`${option.user?.fullName || option.full_name || "Visitor"} (${option.organisation || option.companyName || ""})`}</li>;
          }}
          noOptionsText="No checked-in visitors found"
          value={selectedVisitor}
          onChange={(_, newValue) => setSelectedVisitor(newValue)}
          renderInput={(params) => (
            <TextField 
              {...params} 
              variant="outlined" 
              label="Select Visitor"
              placeholder="Search active visitors..." 
              sx={{ 
                "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "background.paper" }
              }}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {resLoading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </Box>

      <Box sx={{ mb: 3, p: 2, bgcolor: "action.hover", borderRadius: 3, flexShrink: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>REQUESTER</Typography>
        <Typography variant="body1" fontWeight="600">{user?.fullName || "User"}</Typography>
      </Box>

      <Divider sx={{ flexShrink: 0 }} />

      <Box sx={{ flexGrow: 1, overflowY: "auto", minHeight: 0, my: 1 }}>
        <List sx={{ pt: 0 }}>
          {cartItemsLists.map((item) => (
            <ListItem key={`cart-item-${item.id}`} sx={{ px: 0 }}>
              <ListItemText 
                primary={item.name} 
                primaryTypographyProps={{ fontWeight: 700 }}
              />
              <ListItemSecondaryAction>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <IconButton size="small" onClick={() => updateQuantity(item.id, -1)} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}><ICONS.remove fontSize="small" /></IconButton>
                  <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 20, textAlign: "center" }}>{item.quantity}</Typography>
                  <IconButton 
                    size="small" 
                    onClick={() => updateQuantity(item.id, 1)}
                    sx={{ 
                      bgcolor: "primary.main", 
                      color: theme.palette.mode === "dark" ? "#000" : "#fff",
                      "&:hover": { bgcolor: "primary.dark" }
                    }}
                  ><ICONS.add fontSize="small" /></IconButton>
                </Stack>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Box>

      <Divider sx={{ mb: 3, flexShrink: 0 }} />

      <Stack spacing={2} sx={{ flexShrink: 0 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body1" fontWeight="bold">Total Items</Typography>
          <Typography variant="h6" fontWeight="900" color="primary.main">{totalItems}</Typography>
        </Box>

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={() => handlePlaceOrder()}
          disabled={submitting || totalItems === 0}
          sx={{ borderRadius: 4, py: 1.5, fontWeight: "bold" }}
        >
          {submitting ? <CircularProgress size={24} color="inherit" /> : "Confirm & Place Order"}
        </Button>

        <Button
          fullWidth
          variant="text"
          color="error"
          onClick={() => { setCart({}); setCartOpen(false); }}
          sx={{ fontWeight: "bold" }}
        >
          Clear All
        </Button>
      </Stack>
    </Box>
  );

  if (settingsLoading) return <LoadingState />;

  const isModuleOff = isModuleDisabled || (hostSettings && !hostSettings.isKitchenModuleEnabled);

  if (isModuleOff) {
    return (
      <Box sx={{ py: 10, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
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
            mb: 3,
            boxShadow: "0 8px 16px rgba(211, 47, 47, 0.2)"
          }}
        >
          <ICONS.diningTable sx={{ fontSize: 40 }} />
        </Box>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Kitchen Module Disabled
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ maxWidth: 450, opacity: 0.8 }}>
          The kitchen and food service module has been disabled system-wide by the administrator. 
          Please contact support if you believe this is an error.
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => window.location.href = "/cms/dashboard"}
          sx={{ mt: 4, borderRadius: 30, px: 4 }}
        >
          Return to Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          mt: 2,
          mb: 1,
          gap: 2,
        }}
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h5" fontWeight="900" sx={{ letterSpacing: "-0.01em" }}>Food & Beverages</Typography>
            
            <Tooltip title={!isAudioPrimed ? "Audio is locked by browser. Click to unlock." : isMuted ? "Unmute Notifications" : "Mute Notifications"}>
              <IconButton 
                onClick={toggleMute}
                color={!isAudioPrimed ? "error" : isMuted ? "default" : "primary"}
                sx={{ 
                  borderRadius: "50%",
                  bgcolor: (theme) => !isAudioPrimed ? alpha(theme.palette.error.main, 0.1) : "transparent",
                  animation: !isAudioPrimed ? "lockedPulse 2s infinite" : "none",
                  "@keyframes lockedPulse": {
                    "0%, 100%": { opacity: 1 },
                    "50%": { opacity: 0.5 }
                  }
                }}
              >
                {!isAudioPrimed ? <ICONS.volumeOff /> : isMuted ? <ICONS.volumeMute /> : <ICONS.volumeUp />}
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
            Browse menu items and place orders.
          </Typography>
        </Box>
        
        <Stack 
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5} 
          sx={{ 
            width: { xs: "100%", sm: "auto" }, 
            alignItems: "center",
          }}
        >
          <Box sx={{ width: { xs: "100%", sm: "auto" } }}>
            <Badge 
              badgeContent={unseenCount} 
              color="error" 
              overlap="circular"
              anchorOrigin={{ vertical: "top", horizontal: "right" }}
              sx={{ 
                width: "100%",
                "& .MuiBadge-badge": { 
                  top: 2, 
                  right: 2,
                  fontWeight: 800,
                  fontSize: "0.65rem",
                  minWidth: 18,
                  height: 18,
                  border: "2px solid",
                  borderColor: "background.paper"
                }
              }}
            >
              <Button
                variant="outlined"
                color="secondary"
                fullWidth
                startIcon={<ICONS.history />}
                onClick={() => setTrackingOpen(true)}
                sx={{ 
                  borderRadius: 30, 
                  px: 3, 
                  whiteSpace: "nowrap", 
                  fontWeight: "bold", 
                  border: "2px solid",
                  height: 44
                }}
              >
                Track Orders
              </Button>
            </Badge>
          </Box>

          {totalItems > 0 && (
            <Box sx={{ width: { xs: "100%", sm: "auto" } }}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                startIcon={
                  <Badge badgeContent={totalItems} color="error" sx={{ mr: 1 }}>
                    <ICONS.list />
                  </Badge>
                }
                onClick={toggleCart(true)}
                sx={{ 
                  borderRadius: 30, 
                  px: 3, 
                  fontWeight: "bold",
                  height: 44,
                  boxShadow: (theme) => `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`
                }}
              >
                Review Order
              </Button>
            </Box>
          )}
        </Stack>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <ListToolbar
        showingCount={pagedItems.length}
        totalCount={filteredItems.length}
        itemLabel="menu-items"
        searchSlot={
          <TextField
            fullWidth
            size="small"
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: <ICONS.search fontSize="small" sx={{ mr: 1, opacity: 0.6 }} />,
            }}
            sx={{ maxWidth: { md: 360 } }}
          />
        }
        actionsSlot={
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
            <InputLabel>Records per page</InputLabel>
            <Select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(e.target.value);
                setPage(0);
              }}
              label="Records per page"
            >
              {[6, 12, 24, 48].map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        }
      />

      <Box sx={{ mt: 3 }}>
        {filteredItems.length === 0 ? (
          <NoDataAvailable 
            title="No menu items found"
            description={search ? "Try adjusting your search filter." : "The kitchen menu is currently empty."}
          />
        ) : (
          <>
            <ResponsiveCardGrid>
              {pagedItems.map((item) => {
                const qty = cart[item.id] || 0;
                return (
                  <AppCard 
                    key={item.id}
                    sx={{ 
                      height: "100%", 
                      width: "100%",
                      transition: "transform 0.2s ease",
                      "&:hover": { transform: "translateY(-4px)" }
                    }}
                  >
                    <Box sx={{ bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider", p: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1" fontWeight="800" noWrap sx={{ flex: 1 }}>
                          {item.name}
                        </Typography>
                        {qty > 0 && <Chip label={qty} color="primary" size="small" sx={{ fontWeight: 800, height: 20 }} />}
                      </Stack>
                    </Box>
                    
                    <Box sx={{ px: 2, py: 1.5, flexGrow: 1 }}>
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: "0.8rem",
                          lineHeight: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.description || "No description."}
                      </Typography>
                    </Box>

                    <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider", bgcolor: "action.hover" }}>
                      <Stack direction="row" alignItems="center" justifyContent="center" spacing={3}>
                        <IconButton 
                          size="small" 
                          onClick={() => updateQuantity(item.id, -1)}
                          disabled={qty === 0}
                          sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}
                        >
                          <ICONS.remove sx={{ fontSize: 18 }} />
                        </IconButton>
                        
                        <Typography fontWeight="800" sx={{ minWidth: 20, textAlign: "center" }}>
                          {qty}
                        </Typography>
                        
                        <IconButton 
                          size="small" 
                          onClick={() => updateQuantity(item.id, 1)}
                          sx={{ 
                            bgcolor: "primary.main", 
                            color: theme.palette.mode === "dark" ? "#000" : "#fff",
                            "&:hover": { bgcolor: "primary.dark" }
                          }}
                        >
                          <ICONS.add sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Stack>
                    </Box>
                  </AppCard>
                );
              })}
            </ResponsiveCardGrid>
            
            {filteredItems.length > rowsPerPage && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 4, mb: 2 }}>
                <Pagination
                  count={Math.ceil(filteredItems.length / rowsPerPage)}
                  page={page + 1}
                  onChange={(e, v) => setPage(v - 1)}
                  color="primary"
                  showFirstButton
                  showLastButton
                />
              </Box>
            )}
          </>
        )}
      </Box>

      {isMobile ? (
        <SwipeableDrawer
          anchor="bottom"
          open={cartOpen}
          onClose={toggleCart(false)}
          onOpen={toggleCart(true)}
          
          PaperProps={{
            sx: { 
              borderRadius: "24px 24px 0 0",
              height: "88vh", 
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }
          }}
        >
          <Box sx={{ width: "100%", height: 32, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Box sx={{ width: 36, height: 4, bgcolor: "divider", borderRadius: 2 }} />
          </Box>
          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            {SummaryContent}
          </Box>
        </SwipeableDrawer>
      ) : (
        <Drawer
          anchor="right"
          open={cartOpen}
          onClose={toggleCart(false)}
          
          PaperProps={{
            sx: { 
              width: 400,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }
          }}
        >
          {SummaryContent}
        </Drawer>
      )}

      {/* Tracking Modal (Role-aware & Date Filtered) */}
      <OrderTrackingModal 
        open={trackingOpen}
        onClose={() => setTrackingOpen(false)}
        user={user}
      />

      {/* Duplicate Order Confirmation */}
      <Dialog 
        open={duplicateDialog} 
        onClose={() => setDuplicateDialog(false)}
        PaperProps={{ sx: { borderRadius: 4, width: "100%", maxWidth: 400, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, display: "flex", alignItems: "center", gap: 1.5, color: "warning.main" }}>
          <ICONS.warning sx={{ fontSize: 28 }} /> Duplicate Order Detected
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mt: 1, fontWeight: 500, lineHeight: 1.6 }}>
            An identical active order already exists for this visitor. Are you sure you want to place another one?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            variant="outlined" 
            onClick={() => setDuplicateDialog(false)}
            sx={{ borderRadius: 30, textTransform: "none", fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="warning"
            onClick={handleConfirmDuplicate}
            disabled={submitting}
            sx={{ borderRadius: 30, textTransform: "none", fontWeight: 700 }}
          >
            {submitting ? <CircularProgress size={16} color="inherit" /> : "Confirm & Place Anyway"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function KitchenOrderingPage() {
  return (
    <PermissionGuard fullAccessRoles={["superadmin", "admin"]} readOnlyRoles={[]}>
      <OrderingContent />
    </PermissionGuard>
  );
}
