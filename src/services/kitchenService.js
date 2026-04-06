import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

// Menu Item Mapping
const mapMenuItemToFrontend = (item) => ({
  id: item.id,
  name: item.name,
  description: item.description,
  status: item.status,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
  created_by: item.createdBy?.fullName || item.createdById || null,
  updated_by: item.updatedBy?.fullName || item.updatedById || null,
});

// Order Mapping
const mapOrderToFrontend = (order) => ({
  id: order.id,
  status: order.status,
  requester: order.requesterUser?.fullName || "Unknown",
  requester_id: order.requesterUserId,
  is_new: order.isNew,
  items: order.items?.map((item) => ({
    id: item.id,
    name: item.itemNameSnapshot || item.menuItem?.name || "Deleted Item",
    quantity: item.quantity,
  })) || [],
  status_history: order.statusHistory?.map((h) => ({
    id: h.id,
    status: h.metadata?.status || h.status,
    notes: h.notes,
    changed_at: h.changedAt || h.createdAt,
    changed_by: h.changedByUser?.fullName || "System",
  })) || [],
  created_at: order.createdAt,
  updated_at: order.updatedAt,
});

// Menu Items
export const getMenuItems = withApiHandler(async () => {
  const res = await api.get("/kitchen/menu-items");
  const items = res.data?.data || res.data || [];
  return Array.isArray(items) ? items.map(mapMenuItemToFrontend) : [];
});

export const getActiveMenuItems = withApiHandler(async () => {
  const res = await api.get("/kitchen/menu-items/active");
  const items = res.data?.data || res.data || [];
  return Array.isArray(items) ? items.map(mapMenuItemToFrontend) : [];
});

export const createMenuItem = withApiHandler(
  async (data) => {
    const res = await api.post("/kitchen/menu-items", data);
    return mapMenuItemToFrontend(res.data?.data || res.data);
  },
  { showSuccess: true }
);

export const updateMenuItem = withApiHandler(
  async (id, data) => {
    const res = await api.patch(`/kitchen/menu-items/${id}`, data);
    return mapMenuItemToFrontend(res.data?.data || res.data);
  },
  { showSuccess: true }
);

export const deleteMenuItem = withApiHandler(
  async (id) => {
    await api.delete(`/kitchen/menu-items/${id}`);
    return { success: true };
  },
  { showSuccess: true }
);

// Orders
export const getAllOrders = withApiHandler(async () => {
  const res = await api.get("/kitchen/orders");
  const orders = res.data?.data || res.data || [];
  return Array.isArray(orders) ? orders.map(mapOrderToFrontend) : [];
});

export const getNewOrders = withApiHandler(async () => {
  const res = await api.get("/kitchen/orders/status/new");
  const orders = res.data?.data || res.data || [];
  return Array.isArray(orders) ? orders.map(mapOrderToFrontend) : [];
});

export const getOrderById = withApiHandler(async (id) => {
  const res = await api.get(`/kitchen/orders/${id}`);
  return mapOrderToFrontend(res.data?.data || res.data);
});

export const getOrderHistory = withApiHandler(async (id) => {
  const res = await api.get(`/kitchen/orders/${id}/history`);
  const history = res.data?.data || res.data || [];
  return history.map((h) => ({
    id: h.id,
    status: h.metadata?.status || h.status,
    notes: h.notes,
    changed_at: h.changedAt || h.createdAt,
    changed_by: h.changedByUser?.fullName || "System",
  }));
});

export const createOrder = withApiHandler(
  async (data) => {
    const res = await api.post("/kitchen/orders", data);
    return {
      data: mapOrderToFrontend(res.data?.data || res.data),
      message: res.data?.message || "Order placed successfully",
    };
  },
  { showSuccess: true }
);

export const updateOrderStatus = withApiHandler(
  async (id, data) => {
    const res = await api.patch(`/kitchen/orders/${id}/status`, data);
    return {
      data: mapOrderToFrontend(res.data?.data || res.data),
      message: res.data?.message || "Status updated successfully",
    };
  },
  { showSuccess: true }
);
