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

/**
 * Match a returning visitor by their ID custom-field values + phone number.
 * No OTP code is required — the match itself is the verification.
 * On success returns the same shape as verifyOtp (user, lastFieldValues, activeRegistration, …).
 */
export const verifyReturningById = withApiHandler(async (fieldValues, phone) => {
  const { data } = await api.post("/auth/otp/verify-by-id", { fieldValues, phone });
  if (data?.success) {
    return {
      success: true,
      ...data.data,
    };
  }
  return data;
});

export const visitorEditRegistration = withApiHandler(async (id, payload) => {
  const { data } = await api.patch(`/registrations/${id}/visitor-edit`, payload);
  return data?.data ?? data;
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
    email: r.user?.email || null,
    phone: r.user?.phone || "N/A",
    purpose_of_visit: (() => {
      const col = r.purposeOfVisit || null;
      if (col && col !== 'Other') return col;
      if (!Array.isArray(r.fieldValues)) return col;
      const normKey = (s = '') => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const purposeFv = r.fieldValues.find((fv) => {
        const k = normKey(fv.customField?.fieldKey || fv.customField?.field_key);
        return k.includes('purposeofvisit') || k === 'purpose';
      });
      const purposeVal = purposeFv?.value ?? col;
      if (purposeVal !== 'Other') return purposeVal;
      // Resolve "Other" → companion specify field
      const specifyFv = r.fieldValues.find((fv) => {
        const k = normKey(fv.customField?.fieldKey || fv.customField?.field_key);
        return k.includes('specify') || k.includes('otherdetail');
      });
      return specifyFv?.value ?? purposeVal;
    })(),
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
    allow_parking: r.allowParking ?? false,
    is_vip: r.isVip ?? false,
    escort_required: r.escortRequired ?? true,
    department: r.department,
    department_id: r.departmentId,
    access_level: r.accessLevel,
    access_level_id: r.accessLevelId,
    access_levels: r.accessLevels ?? [],
    vehicle_plate: r.vehiclePlate ?? null,
    approval_note: r.approvalNote ?? null,
    vip_reason: r.vipReason ?? null,
    admin_approved_at: r.adminApprovedAt,
    admin_approved_by_user_id: r.adminApprovedByUserId,
    admin_rejection_reason: r.adminRejectionReason,
    is_vip_fast_track: r.isVipFastTrack ?? false,
    vip_fast_track_approved_at: r.vipFastTrackApprovedAt,
    recurring_type: r.recurringType ?? null,
    recurring_days: r.recurringDays ?? null,
    recurring_time_from: r.recurringTimeFrom ?? null,
    recurring_time_to: r.recurringTimeTo ?? null,
    current_visit_end: r.currentVisitEnd ?? null,
    ...r,
  };

  if (Array.isArray(r.history)) {
    mapped.history = r.history.map(mapRegistration);
  }

  return mapped;
};

export const getRegistrations = withApiHandler(async (status = null, { from, to } = {}, userId) => {
  const params = {};
  if (status && status !== "all") params.status = status;
  if (from) params.from = from;
  if (to) params.to = to;
  if (userId) params.userId = userId;
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

export const createVipRegistration = withApiHandler(
  async (fieldValues) => {
    const { data } = await api.post("/registrations/vip-fast-track", { fieldValues });
    return data?.data ?? data;
  },
  { showSuccess: true }
);

export const createVipRevisit = withApiHandler(
  async (registrationId) => {
    const { data } = await api.post(`/registrations/${registrationId}/vip-revisit`);
    return data?.data ?? data;
  },
  { showSuccess: true }
);

export const getVipFastTrackFields = withApiHandler(async () => {
  const res = await api.get("/custom-fields/vip-fast-track");
  const payload = res.data?.data ?? res.data ?? [];
  const fields = Array.isArray(payload) ? payload : [];
  return [...fields].sort(
    (a, b) => Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0)
  );
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

// Fetch checked-in registrations for the kitchen order picker — gated by kitchen:read,
// department-scoped. Used in cms/kitchen so a kitchen admin can pick who to order for
// without needing full visits/visitors access.
export const getKitchenEligibleVisitors = withApiHandler(async () => {
  const res = await api.get('/registrations/for-kitchen');
  const registrations = res.data?.data || res.data || [];
  return Array.isArray(registrations) ? registrations.map(mapRegistration) : [];
});

export const getCurrentlyInside = withApiHandler(async () => {
  const res = await api.get('/registrations/currently-inside');
  const payload = res.data?.data ?? res.data ?? [];
  return Array.isArray(payload) ? payload.map(mapRegistration) : [];
});

export const getTodayVisitors = withApiHandler(async () => {
  const res = await api.get('/registrations/today');
  const payload = res.data?.data ?? res.data ?? [];
  return Array.isArray(payload) ? payload.map(mapRegistration) : [];
});

/**
 * Fetch the list of existing visitors an admin may create new visits for.
 * SuperAdmin sees all visitors; departmental admin sees only visitors who
 * have previously visited their department(s).
 */
export const getEligibleVisitors = withApiHandler(async () => {
  const res = await api.get("/registrations/eligible-visitors");
  const data = res.data?.data || res.data || [];
  return Array.isArray(data)
    ? data.map((u) => ({
        id: u.id,
        fullName: u.fullName || u.full_name || "",
        email: u.email || "",
        phone: u.phone || "",
        iso_code: u.iso_code || null,
        hasActiveVisit: u.hasActiveVisit ?? false,
      }))
    : [];
});

/**
 * Admin creates one or more visits on behalf of existing visitors.
 * Returns { created: Registration[], skipped: { userId, reason }[] }.
 */
export const adminCreateVisits = withApiHandler(
  async (payload) => {
    const { data } = await api.post("/registrations/admin-create", payload);
    return data?.data ?? data;
  },
  { showSuccess: true },
);

export async function exportRegistrationsXlsx(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const res = await api.get(
    '/registrations/export-registrations',
    {
      params: {
        ids: ids.join(','),
        tzOffset: new Date().getTimezoneOffset(),
        tzName: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      responseType: 'blob',
    },
  );
  const date = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = `registrations-${date}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
