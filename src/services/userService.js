// Mock user service
export const getAllStaffUsers = async () => {
  return [
    { id: 1, name: "Gate Staff", email: "staff@sinan.com", role: "staff" },
  ];
};

export const createStaffUser = async (data) => ({ success: true });
export const createAdminUser = async (data) => ({ success: true });
export const createBusinessUser = async (data) => ({ success: true });

export const getAllUsers = async () => {
  return [
    { id: 1, name: "Gate Staff", email: "staff@sinan.com", role: "staff" },
    { id: 2, name: "Platform Admin", email: "admin@sinan.com", role: "admin" },
    { id: 3, name: "Root Operator", email: "super@sinan.com", role: "superadmin" },
  ];
};

export const getUnassignedUsers = async () => [];
export const getUserById = async (id) => ({ id, name: "Mock User" });
export const updateUser = async (id, data) => ({ success: true });
export const deleteUser = async (id) => ({ success: true });
