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

export const sendOtpSilently = async (target) => {
  try {
    const { data } = await api.post("/auth/otp/send", { target });
    return data;
  } catch (err) {
    const message =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      "Unable to send OTP. Please try again.";

    return { error: true, message };
  }
};

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

export const mapRegistration = (r) => {
  if (!r) return r;
  const mapped = {
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
    qr_token: r.qrToken,
    rejection_reason: r.rejectionReason,
    allow_multi_checkin: r.allowMultiCheckin,
    department: r.department,
    department_id: r.departmentId,
    access_level: r.accessLevel,
    access_level_id: r.accessLevelId,
    admin_approved_at: r.adminApprovedAt,
    admin_approved_by_user_id: r.adminApprovedByUserId,
    admin_rejection_reason: r.adminRejectionReason,
    ...r,
  };

  if (Array.isArray(r.history)) {
    mapped.history = r.history.map(mapRegistration);
  }

  return mapped;
};

export const getRegistrations = withApiHandler(async (status = null, { from, to } = {}) => {
  const params = {};
  if (status && status !== "all") params.status = status;
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await api.get("/registrations", { params });
  const registrations = res.data?.data || res.data || [];

  return Array.isArray(registrations)
    ? registrations.map(mapRegistration)
    : [];
});

export const getRegistrationById = withApiHandler(async (id) => {
  const res = await api.get(`/registrations/${id}`);
  const r = res.data?.data || res.data;
  if (!r) return null;

  const mapped = mapRegistration(r);
  if (Array.isArray(r.history)) {
    mapped.history = r.history.map(mapRegistration);
  }

  return mapped;
});

export const updateStatus = withApiHandler(
  async (id, payload) => {
    const res = await api.patch(`/registrations/${id}/status`, payload);
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

export const getRegistrationActivityLogs = withApiHandler(async (id) => {
  const res = await api.get(`/registrations/${id}/activity-logs`);
  return res.data?.data || res.data || [];
});

export async function exportVisitorHistoryCsv(registrationId) {
  const params = new URLSearchParams({
    tzOffset: String(new Date().getTimezoneOffset()),
    tzName: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const res = await api.get(`/registrations/${registrationId}/export-csv?${params.toString()}`, {
    responseType: "blob",
  });

  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `visitor-history-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export const checkNdaValidity = withApiHandler(async (email) => {
  const { data } = await api.get("/nda-templates/public/validity-check", { params: { email } });
  return data?.data || data;
});

export const verifyRegistrationByToken = withApiHandler(async (token) => {
  const { data } = await api.get(`/registrations/verify`, { params: { token } });
  const result = data?.data || data;

  if (!result) return null;

  if (result.notApproved) {
    return result;
  }

  return {
    ...mapRegistration(result),
    notApproved: result.notApproved,
    visitor: result.visitor,
    visitEnded: result.visitEnded,
  };
});

export const verifyRegistrationById = withApiHandler(async (idNumber) => {
  const { data } = await api.get(`/registrations/verify-by-id`, { params: { idNumber } });
  const results = data?.data || data;

  if (!results || !Array.isArray(results)) return [];

  return results.map(result => ({
    ...mapRegistration(result),
    notApproved: result.notApproved,
    visitor: result.visitor,
    visitEnded: result.visitEnded,
  }));
});
