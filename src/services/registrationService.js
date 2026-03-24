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

// MOCK OTP Handling
export const sendOtp = async (target, channel = "email") => {
  console.log(`[Mock] Sending OTP to ${target} via ${channel}...`);
  await new Promise(r => setTimeout(r, 800));
  return { success: true, message: "OTP sent successfully" };
};

export const verifyOtp = async (target, code) => {
  console.log(`[Mock] Verifying OTP ${code} for ${target}`);
  await new Promise(r => setTimeout(r, 800));
  
  if (code !== "1234") {
    throw new Error("Invalid OTP code. Use 1234 for testing.");
  }

  if (target === "visitor@sinan.com" || target === "98765432") {
    return {
      success: true,
      is_new_user: false,
      user: {
        id: "v-789",
        role: "visitor",
        full_name: "Sara Ajaz",
        email: "visitor@sinan.com",
        phone: "98765432",
        company_name: "Sinan Tech",
      }
    };
  }

  return {
    success: true,
    is_new_user: true,
    user: {
      role: "visitor",
      email: target.includes("@") ? target : null,
      phone: !target.includes("@") ? target : null
    }
  };
};

export const createRegistration = async (payload) => {
  try {
    const res = await api.post("/registrations", {
      userId: payload.user_id || undefined,
      fieldValues: payload.field_values || {},
      requestedDate: payload.requested_date || new Date().toISOString().split("T")[0],
      purposeOfVisit: payload.purpose_of_visit || "",
      requestedTimeFrom: payload.requested_time_from || "09:00:00",
      requestedTimeTo: payload.requested_time_to || "17:00:00",
    });
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
      requested_date: r.requestedDate,
      requested_time_from: r.requestedTimeFrom,
      requested_time_to: r.requestedTimeTo,
      approved_date: r.approvedDate,
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

    return {
      id: r.id,
      full_name: r.user?.fullName || "N/A",
      email: r.user?.email || "N/A",
      phone: r.user?.phone || "N/A",
      purpose_of_visit: r.purposeOfVisit,
      status: r.status,
      requested_date: r.requestedDate,
      requested_time_from: r.requestedTimeFrom,
      requested_time_to: r.requestedTimeTo,
      approved_date: r.approvedDate,
      approved_time_from: r.approvedTimeFrom,
      approved_time_to: r.approvedTimeTo,
      created_at: r.createdAt,
      qr_token: r.qrToken,
      rejection_reason: r.rejectionReason,
      ...r 
    };
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
    const res = await api.get(`/registrations/verify/${token}`);
    return res.data;
  } catch (err) {
    return null;
  }
};
