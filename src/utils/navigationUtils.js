/**
 * Returns the correct dashboard destination for a staff user based on their staffType.
 * 
 * @param {Object} staffUser - The user object from useAuth
 * @returns {string} The relative path to the staff member's dashboard
 */
export const getStaffDestination = (staffUser) => {
  if (staffUser?.role !== "staff") return "/cms/dashboard";
  
  switch (staffUser?.staffType) {
    case "kitchen":
      return "/staff/kitchen/orders";
    case "gate":
      return "/staff/gate/verify";
    default:
      return "/"; // Default fallback
  }
};
