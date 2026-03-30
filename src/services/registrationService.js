import api from "./api";
import withApiHandler from "@/utils/withApiHandler";

export const getFields = withApiHandler(async () => {
  const res = await api.get("/registrations/form/fields");
  const payload = res.data?.data ?? res.data ?? [];
  const fields = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.fields)
      ? payload.fields
      : [];

  return [...fields].sort(
    (a, b) => Number(a?.sortOrder ?? a?.sort_order ?? 0) - Number(b?.sortOrder ?? b?.sort_order ?? 0)
  );
});

export const sendOtp = withApiHandler(async (target) => {
  const { data } = await api.post("/auth/otp/send", { target });
  return data;
});

export const verifyOtp = withApiHandler(async (target, code) => {
  const { data } = await api.post("/auth/otp/verify", { target, code });
  if (data?.success) {
    return {
      success: true,
      ...data.data,
    };
  }
  return data;
});

export const createRegistration = withApiHandler(
  async (payload) => {
    const { data } = await api.post("/registrations", payload);
    return data?.data;
  },
  { showSuccess: true }
);

export const getRegistrations = withApiHandler(async (status = null) => {
  const params = status && status !== "all" ? { status } : {};
  const res = await api.get("/registrations", { params });
  const registrations = res.data?.data || res.data || [];

  return Array.isArray(registrations)
    ? registrations.map((r) => ({
        id: r.id,
        full_name: r.user?.fullName || "N/A",
        email: r.user?.email || "N/A",
        phone: r.user?.phone || "N/A",
        purpose_of_visit: r.purposeOfVisit,
        status: r.status,
        requested_from: r.requestedFrom,
        requested_to: r.requestedTo,
        approved_from: r.approvedFrom,
        approved_to: r.approvedTo,
        phone_iso_code: r.phoneIsoCode,
        created_at: r.createdAt,
        checked_in_at: r.checkedInAt,
        checked_out_at: r.checkedOutAt,
        qr_token: r.qrToken,
        rejection_reason: r.rejectionReason,
        ...r,
      }))
    : [];
});

export const getRegistrationById = withApiHandler(async (id) => {
  const res = await api.get(`/registrations/${id}`);
  const r = res.data?.data || res.data;
  if (!r) return null;

  const mapRegistration = (reg) => ({
    id: reg.id,
    full_name: reg.user?.fullName || r.user?.fullName || "N/A",
    email: reg.user?.email || r.user?.email || "N/A",
    phone: reg.user?.phone || r.user?.phone || "N/A",
    purpose_of_visit: reg.purposeOfVisit,
    status: reg.status,
    requested_from: reg.requestedFrom,
    requested_to: reg.requestedTo,
    approved_from: reg.approvedFrom,
    approved_to: reg.approvedTo,
    phone_iso_code: reg.phoneIsoCode,
    created_at: reg.createdAt,
    checked_in_at: reg.checkedInAt,
    checked_out_at: reg.checkedOutAt,
    qr_token: reg.qrToken,
    rejection_reason: reg.rejectionReason,
    fieldValues: reg.fieldValues,
    ...reg,
  });

  const mapped = mapRegistration(r);
  if (Array.isArray(r.history)) {
    mapped.history = r.history.map(mapRegistration);
  }

  return mapped;
});

export const updateRegistrationStatus = withApiHandler(
  async (id, action, payload = {}) => {
    const endpoint = `/registrations/${id}/${action}`;
    const res = await api.patch(endpoint, payload);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const updateRegistration = withApiHandler(
  async (id, payload) => {
    const res = await api.patch(`/registrations/${id}`, payload);
    return res.data?.data || res.data;
  },
  { showSuccess: true }
);

export const verifyRegistrationByToken = withApiHandler(async (token) => {
  const { data } = await api.get(`/registrations/verify`, { params: { token } });
  const result = data?.data || data;

  if (!result) return null;

  if (result.notApproved) {
    return result;
  }

  return {
    id: result.id,
    full_name: result.user?.fullName || "N/A",
    email: result.user?.email || "N/A",
    phone: result.user?.phone || "N/A",
    purpose_of_visit: result.purposeOfVisit,
    status: result.status,
    requested_from: result.requestedFrom,
    requested_to: result.requestedTo,
    approved_from: result.approvedFrom,
    approved_to: result.approvedTo,
    phone_iso_code: result.phoneIsoCode,
    checked_in_at: result.checkedInAt,
    checked_out_at: result.checkedOutAt,
    qr_token: result.qrToken,
    notApproved: result.notApproved,
    visitor: result.visitor,
    user: result.user,
    ...result,
  };
});

export const checkInRegistration = withApiHandler(
  async (id) => {
    const { data } = await api.patch(`/registrations/${id}/checkin`);
    return data?.data || data;
  },
  { showSuccess: true }
);

export const checkOutRegistration = withApiHandler(
  async (id) => {
    const { data } = await api.patch(`/registrations/${id}/checkout`);
    return data?.data || data;
  },
  { showSuccess: true }
);
