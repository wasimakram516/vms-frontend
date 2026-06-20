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
  is_seen_by_requester: order.isSeenByRequester,
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
  updated_by_user: order.updatedBy?.fullName || null,
  visitor_name: order.visitor?.fullName || order.registration?.user?.fullName || null,
  visitor_organisation: (
    order.registration?.organisation || 
    order.registration?.companyName || 
    order.visitor?.companyName || 
    order.registration?.fieldValues?.find(fv => {
      const k = (fv.customField?.fieldKey || fv.custom_field?.field_key || "").toLowerCase();
      return k === "organisation" || k === "organization" || k === "company" || k === "companyname";
    })?.value ||
    null
  ),
  registration_id: order.registrationId || null,
  created_at: order.createdAt,
  updated_at: order.updatedAt,
});

// Menu Items
// Fetch kitchen orders for a specific registration — gated by visits:read, department-scoped.
// Used in cms/visitors history tab so a dept admin with visits access can see a visit's orders
// without needing full kitchen access.
export const getKitchenOrdersForRegistration = withApiHandler(async (registrationId) => {
  const res = await api.get(`/kitchen/orders/by-registration/${registrationId}`);
  const orders = res.data?.data || res.data || [];
  return Array.isArray(orders) ? orders.map(mapOrderToFrontend) : [];
});

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
export const getAllOrders = withApiHandler(async (params = {}) => {
  const { date, registrationId } = params;
  let url = "/kitchen/orders";
  const queryParts = [];
  if (date) queryParts.push(`date=${date}`);
  if (registrationId) queryParts.push(`registrationId=${registrationId}`);
  
  if (queryParts.length > 0) {
    url += `?${queryParts.join("&")}`;
  }

  const res = await api.get(url);
  const orders = res.data?.data || res.data || [];
  return Array.isArray(orders) ? orders.map(mapOrderToFrontend) : [];
});

export const getMyOrders = withApiHandler(async (date) => {
  const url = date ? `/kitchen/orders/my-orders?date=${date}` : "/kitchen/orders/my-orders";
  const res = await api.get(url);
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
  async (data, force = false) => {
    const res = await api.post(`/kitchen/orders${force ? "?force=true" : ""}`, data);
    return {
      data: mapOrderToFrontend(res.data?.data || res.data),
      message: res.data?.message || "Order placed successfully",
    };
  },
  { showSuccess: true, suppressErrorStatus: [409] }
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

export const updateOrderStatusSilent = withApiHandler(
  async (id, data) => {
    const res = await api.patch(`/kitchen/orders/${id}/status`, data);
    return {
      data: mapOrderToFrontend(res.data?.data || res.data),
      message: res.data?.message || "Status updated successfully",
    };
  },
  { showSuccess: false }
);

export const cancelOrder = withApiHandler(
  async (id, notes) => {
    const res = await api.post(`/kitchen/orders/${id}/cancel`, { notes });
    return {
      data: mapOrderToFrontend(res.data?.data || res.data),
      message: res.data?.message || "Order cancelled",
    };
  },
  { showSuccess: true }
);

export const markOrdersAsSeen = withApiHandler(async () => {
  const res = await api.patch("/kitchen/orders/mark-seen");
  return res.data;
});
