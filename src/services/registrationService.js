import api from "./api";

export const getFields = async () => {
  try {
    const res = await api.get("/registrations/form/fields");
    const data = res.data?.data || [];
    return data.sort((a,b) => a.sortOrder - b.sortOrder);
  } catch (err) {
    console.error("Failed to fetch fields", err);
    throw err;
  }
};

export const sendOtp = async (target) => {
  try {
    const res = await api.post("/auth/otp/send", { target });
    return res.data;
  } catch (err) {
    console.error("Failed to send OTP", err);
    throw err;
  }
};

export const verifyOtp = async (target, code) => {
  try {
    const res = await api.post("/auth/otp/verify", { target, code });
    if (res.data?.success) {
      return {
        success: true,
        ...res.data.data
      };
    }
    return res.data;
  } catch (err) {
    console.error("OTP verification failed", err);
    throw err;
  }
};

export const createRegistration = async (payload) => {
  try {
    const res = await api.post("/registrations", payload);
    return res.data?.data;
  } catch (err) {
    console.error("Registration failed", err);
    throw err;
  }
};

export const getRegistrations = async (status = null) => {
  try {
    const params = status && status !== "all" ? { status } : {};
    const res = await api.get("/registrations", { params });
    const registrations = res.data?.data || res.data || [];
    
    return Array.isArray(registrations) ? registrations.map(r => ({
      id: r.id,
      full_name: r.user?.fullName || "N/A",
      email: r.user?.email || "N/A",
      phone: r.user?.phone || "N/A",
      purpose_of_visit: r.purposeOfVisit,
      status: r.status,
      requested_date_from: r.requestedDateFrom,
      requested_date_to: r.requestedDateTo,
      requested_time_from: r.requestedTimeFrom,
      requested_time_to: r.requestedTimeTo,
      approved_date_from: r.approvedDateFrom,
      approved_date_to: r.approvedDateTo,
      approved_time_from: r.approvedTimeFrom,
      approved_time_to: r.approvedTimeTo,
      created_at: r.createdAt,
      qr_token: r.qrToken,
      rejection_reason: r.rejectionReason,
      ...r
    })) : [];
  } catch (err) {
    console.error("Failed to fetch registrations", err);
    return [];
  }
};

export const getRegistrationById = async (id) => {
  try {
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
      requested_date_from: reg.requestedDateFrom,
      requested_date_to: reg.requestedDateTo,
      requested_time_from: reg.requestedTimeFrom,
      requested_time_to: reg.requestedTimeTo,
      approved_date_from: reg.approvedDateFrom,
      approved_date_to: reg.approvedDateTo,
      approved_time_from: reg.approvedTimeFrom,
      approved_time_to: reg.approvedTimeTo,
      created_at: reg.createdAt,
      checked_in_at: reg.checkedInAt,
      checked_out_at: reg.checkedOutAt,
      qr_token: reg.qrToken,
      rejection_reason: reg.rejectionReason,
      fieldValues: reg.fieldValues,
      ...reg 
    });

    const mapped = mapRegistration(r);
    if (Array.isArray(r.history)) {
      mapped.history = r.history.map(mapRegistration);
    }

    return mapped;
  } catch (err) {
    console.error(`Failed to fetch registration ${id}`, err);
    throw err;
  }
};

export const updateRegistrationStatus = async (id, action, payload = {}) => {
  try {
    let endpoint = `/registrations/${id}/${action}`;
    
    const res = await api.patch(endpoint, payload);
    return res.data?.data || res.data;
  } catch (err) {
    console.error(`Failed to ${action} registration`, err);
    throw err;
  }
};

export const updateRegistration = async (id, payload) => {
  try {
    const res = await api.patch(`/registrations/${id}`, payload);
    return res.data?.data || res.data;
  } catch (err) {
    console.error(`Failed to update registration ${id}`, err);
    throw err;
  }
};

export const verifyRegistrationByToken = async (token) => {
  try {
    const res = await api.get(`/registrations/verify`, { params: { token } });
    const data = res.data?.data || res.data;
    
    if (!data) return null;

    if (data.notApproved) {
      return data;
    }

    return {
      id: data.id,
      full_name: data.user?.fullName || "N/A",
      email: data.user?.email || "N/A",
      phone: data.user?.phone || "N/A",
      purpose_of_visit: data.purposeOfVisit,
      status: data.status,
      approved_date_from: data.approvedDateFrom,
      approved_date_to: data.approvedDateTo,
      approved_time_from: data.approvedTimeFrom,
      approved_time_to: data.approvedTimeTo,
      qr_token: data.qrToken,
      notApproved: data.notApproved,
      visitor: data.visitor,
      user: data.user,
      ...data
    };
  } catch (err) {
    return null;
  }
};

export const checkInRegistration = async (id) => {
  try {
    const res = await api.patch(`/registrations/${id}/checkin`);
    return res.data?.data || res.data;
  } catch (err) {
    console.error("Failed to check in registration", err);
    throw err;
  }
};

export const checkOutRegistration = async (id) => {
  try {
    const res = await api.patch(`/registrations/${id}/checkout`);
    return res.data?.data || res.data;
  } catch (err) {
    console.error("Failed to check out registration", err);
    throw err;
  }
};
