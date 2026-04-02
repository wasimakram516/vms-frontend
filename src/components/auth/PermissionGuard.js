"use client";

import { useAuth } from "@/contexts/AuthContext";
import LoadingState from "@/components/LoadingState";
import { createContext, useContext } from "react";

const PermissionContext = createContext({ readOnly: false });

/**
 * PermissionGuard — like RoleGuard but instead of redirecting lesser roles,
 * it renders children in read-only mode. Use `usePermission()` in child
 * components to check `readOnly`.
 *
 * @param {string[]} fullAccessRoles   - Roles that get full read/write access
 * @param {string[]} readOnlyRoles     - Roles that can view but not mutate
 * @param {React.ReactNode} children
 */
export default function PermissionGuard({ fullAccessRoles = [], readOnlyRoles = [], children }) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <LoadingState />;
  }

  const hasFullAccess = fullAccessRoles.includes(user.role);
  const hasReadOnly = readOnlyRoles.includes(user.role);

  if (!hasFullAccess && !hasReadOnly) {
    // Not allowed at all — render nothing (parent RoleGuard should already
    // prevent unauthorised navigation, but just in case)
    return null;
  }

  return (
    <PermissionContext.Provider value={{ readOnly: !hasFullAccess }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission() {
  return useContext(PermissionContext);
}
