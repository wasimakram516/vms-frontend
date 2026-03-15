// Mock dashboard service for Phase 1
export const getDashboardInsights = async () => {
  return {
    total_registrations: 124,
    pending_approvals: 12,
    checked_in_today: 45,
    active_visitors: 8,
  };
};

export const refreshDashboardInsights = async () => {
  return { success: true };
};
