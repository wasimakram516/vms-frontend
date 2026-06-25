const PAGES = [
  // ── Departmental Admin ──
  // Ordered by mental model: operations → visit config → insights → administration → kitchen
  { pageId: "visits", label: "Visits", actions: ["read", "create", "update"], roles: ["admin:departmental"] },
  { pageId: "visitors", label: "Visitors", actions: ["read", "update"], roles: ["admin:departmental"] },
  { pageId: "nda-forms", label: "NDA Forms", actions: ["read"], roles: ["admin:departmental"] },
  { pageId: "departments", label: "Departments", actions: ["read", "create", "update", "delete"], roles: ["admin:departmental"] },
  { pageId: "access-levels", label: "Access Levels", actions: ["read", "create", "update", "delete"], roles: ["admin:departmental"] },
  { pageId: "fields", label: "Custom Fields", actions: ["read", "create", "update", "delete"], roles: ["admin:departmental"] },
  { pageId: "analytics", label: "Analytics", actions: ["read"], roles: ["admin:departmental"] },
  { pageId: "users", label: "Users", actions: ["read", "create", "update", "delete"], roles: ["admin:departmental"] },
  { pageId: "host-details", label: "Host Details", actions: ["read", "create", "update", "delete"], roles: ["admin:departmental"] },
  { pageId: "kitchen", label: "Kitchen Orders", actions: ["read", "create", "update"], roles: ["admin:departmental", "admin:kitchen"] },
  { pageId: "kitchen-menu", label: "Kitchen Menu", actions: ["read", "create", "update", "delete"], roles: ["admin:departmental", "admin:kitchen"] },
  // ── Kitchen Staff ──
  { pageId: "kitchen", label: "Kitchen Orders", actions: ["receive", "prepare", "ready", "deliver", "history"], roles: ["staff:kitchen"] },
  // ── Gate Staff ──
  { pageId: "verify", label: "Verify Entry", actions: ["read", "checkin", "checkout", "vip-bypass", "todays-visitors"], roles: ["staff:gate"] },
];

export const ROLE_KEYS = [
  { key: "admin:departmental", label: "Departmental Admin", description: "Admin managing department-level visits" },
  { key: "admin:kitchen", label: "Kitchen Admin", description: "Admin managing kitchen orders and menus" },
  { key: "staff:gate", label: "Gate Staff", description: "Staff handling gate check-in/out and visitor verification" },
  { key: "staff:kitchen", label: "Kitchen Staff", description: "Staff preparing and fulfilling kitchen orders" },
];

export function getPagesForRole(roleKey) {
  return PAGES.filter((p) => p.roles.includes(roleKey));
}

export default PAGES;
