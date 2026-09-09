import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

export const getActivityLogs = withApiHandler(
  async ({ page = 1, limit = 25, activityType, from, to } = {}) => {
    const params = {
      page,
      limit,
      tzOffset: new Date().getTimezoneOffset(),
    };
    if (activityType) params.activityType = activityType;
    if (from) params.from = from;
    if (to) params.to = to;

    const res = await api.get("/registration-activity-logs", { params });
    // Backend response is wrapped in { success, message, data }, where data is the
    // paginated result { data: [...], total, page, limit }.
    const payload = res.data?.data ?? res.data ?? {};
    const items = Array.isArray(payload.data) ? payload.data : [];
    return {
      data: {
        data: items,
        total: payload.total ?? items.length,
        page: payload.page ?? page,
        limit: payload.limit ?? limit,
      },
    };
  }
);

export const markBadgesPrinted = withApiHandler(
  async (registrationIds = []) => {
    const ids = Array.isArray(registrationIds)
      ? registrationIds.filter(Boolean)
      : [];
    if (ids.length === 0) return { data: { logged: 0, total: 0 } };
    const res = await api.post("/registration-activity-logs/badge-printed", {
      registrationIds: ids,
    });
    return res.data?.data ?? res.data;
  },
  { silent: true }
);

// One activity entry for a whole badge-PDF export (not one per visitor).
export const markBadgesExported = withApiHandler(
  async (registrationIds = []) => {
    const ids = Array.isArray(registrationIds)
      ? registrationIds.filter(Boolean)
      : [];
    if (ids.length === 0) return { data: { logged: 0 } };
    const res = await api.post("/registration-activity-logs/badges-exported", {
      registrationIds: ids,
    });
    return res.data?.data ?? res.data;
  },
  { silent: true }
);

// One activity entry for a visit-list (CSV/XLSX) export — separate from badge prints.
export const logVisitsExported = withApiHandler(
  async (registrationIds = [], format = "xlsx") => {
    const ids = Array.isArray(registrationIds)
      ? registrationIds.filter(Boolean)
      : [];
    if (ids.length === 0) return { data: { logged: 0 } };
    const res = await api.post("/registration-activity-logs/visits-exported", {
      registrationIds: ids,
      format,
    });
    return res.data?.data ?? res.data;
  },
  { silent: true }
);

// One activity entry for a per-visitor visit-history export (feed-only). The
// visitor is identified by `visitorId` so the feed can link to their details.
export const logVisitHistoryExported = withApiHandler(
  async ({
    registrationId,
    visitorId,
    visitorName,
    visitorIdNo,
    visitorIdType,
    visitorIdCountry,
  } = {}) => {
    const res = await api.post("/registration-activity-logs/visit-history-exported", {
      registrationId: registrationId ?? undefined,
      visitorId: visitorId ?? undefined,
      visitorName: visitorName ?? undefined,
      visitorIdNo: visitorIdNo ?? undefined,
      visitorIdType: visitorIdType ?? undefined,
      visitorIdCountry: visitorIdCountry ?? undefined,
    });
    return res.data?.data ?? res.data;
  },
  { silent: true }
);