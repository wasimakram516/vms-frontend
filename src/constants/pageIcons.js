import ICONS from "@/utils/iconUtil";

// Shared resource → icon map so the Access Control screen and the per-user
// permission-override dialog show identical icons for each page/resource.
export const PAGE_ICONS = {
  visits: ICONS.checkin,
  visitors: ICONS.badge,
  "nda-forms": ICONS.verified,
  departments: ICONS.apartment,
  "access-levels": ICONS.key,
  fields: ICONS.form,
  analytics: ICONS.insights,
  users: ICONS.people,
  "access-control": ICONS.security,
  "host-details": ICONS.business,
  kitchen: ICONS.diningTable,
  "kitchen-menu": ICONS.restaurant,
  verify: ICONS.checkCircle,
};

export function getPageIcon(pageId) {
  return PAGE_ICONS[pageId] || null;
}
