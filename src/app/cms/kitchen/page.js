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
} from "@mui/material";
import { useEffect, useState, useMemo } from "react";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import AppCard from "@/components/cards/AppCard";
import ListToolbar from "@/components/ListToolbar";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveMenuItems, createOrder } from "@/services/kitchenService";
import OrderTrackingModal from "./OrderTrackingModal";

function OrderingContent() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const [page, setPage] = useState(0);

  const [cart, setCart] = useState({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedCart = localStorage.getItem("kitchen_cart");
    
    if (savedCart) {
      try { setCart(JSON.parse(savedCart)); } catch (e) { console.error(e); }
    }
    
    fetchData().finally(() => setIsReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isReady) return;
    localStorage.setItem("kitchen_cart", JSON.stringify(cart));
  }, [cart, isReady]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const menuRes = await getActiveMenuItems();
      setItems(Array.isArray(menuRes) ? menuRes : []);
    } finally {
      setLoading(false);
    }
  };

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

  const handlePlaceOrder = async () => {
    setSubmitting(true);
    try {
      const orderItems = Object.entries(cart).map(([itemId, quantity]) => ({
        menuItemId: itemId,
        quantity,
      }));

      const res = await createOrder({
        items: orderItems,
      });

      if (res && !res.error) {
        setCart({});
        setCartOpen(false);
        localStorage.removeItem("kitchen_cart");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;

  const toggleCart = (open) => () => {
    setCartOpen(open);
  };

  const SummaryContent = (
    <Box sx={{ 
      p: isMobile ? "0 24px 24px 24px" : 3, 
      display: "flex", 
      flexDirection: "column", 
      height: "100%",
      overflow: "hidden" 
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexShrink: 0 }}>
        <Typography variant="h6" fontWeight="900">Order Details</Typography>
        <IconButton onClick={toggleCart(false)}><ICONS.close /></IconButton>
      </Stack>

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
          onClick={handlePlaceOrder}
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

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "center" },
          mt: 2,
          mb: 1,
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight="bold">
            Kitchen Orders
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
            Browse menu items and place orders.
          </Typography>
        </Box>
        
        <Stack 
          direction={{ xs: "column", sm: "row" }} 
          spacing={2} 
          sx={{ width: { xs: "100%", sm: "auto" }, alignItems: "stretch" }}
        >
          <Button
            variant="outlined"
            color="secondary"
            fullWidth={isMobile && totalItems === 0}
            startIcon={<ICONS.history />}
            onClick={() => setTrackingOpen(true)}
            sx={{ borderRadius: 30, px: 3, whiteSpace: "nowrap", fontWeight: "bold", border: "2px solid" }}
          >
            Track Orders
          </Button>

          {totalItems > 0 && (
            <Button
              variant="contained"
              color="primary"
              fullWidth={isMobile}
              startIcon={
                <Badge badgeContent={totalItems} color="error" sx={{ mr: 1 }}>
                  <ICONS.list />
                </Badge>
              }
              onClick={toggleCart(true)}
              sx={{ borderRadius: 30, px: 3, whiteSpace: "nowrap" }}
            >
              Review Order
            </Button>
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
