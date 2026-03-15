// Mock registration service
export const getRegistrations = async () => {
  return [
    { id: "1", full_name: "Sara Ajaz", email: "sara@example.com", phone: "+965 98765432", purpose_of_visit: "Interview", status: "approved", created_at: "2026-03-15" },
    { id: "2", full_name: "Ali Hassan", email: "ali@example.com", phone: "+965 44433221", purpose_of_visit: "Meeting", status: "pending", created_at: "2026-03-15" },
  ];
};

export const createRegistration = async (data) => {
  console.log("Mock Registration Created:", data);
  return {
    success: true,
    token: `SN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    ...data
  };
};

export const verifyRegistrationByToken = async (token) => {
  if (token.toUpperCase().startsWith("SN-")) {
    return {
      token: token.toUpperCase(),
      full_name: "Sara Ajaz",
      purpose: "Delivery",
      id_number: "2883392210",
      status: "approved"
    };
  }
  return null;
};

export const updateRegistrationStatus = async (id, status) => {
  return { id, status, success: true };
};
