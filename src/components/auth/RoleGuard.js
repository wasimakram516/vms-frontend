"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import LoadingState from "@/components/LoadingState";

import { getStaffDestination } from "@/utils/navigationUtils";

/**
 * RoleGuard Component
 * @param {Object} props
 * @param {Array<string>} props.allowedRoles - User roles to allow (e.g., ["admin", "staff"])
 * @param {Array<string>} props.allowedStaffTypes - Staff types to allow (e.g., ["gate", "kitchen"])
 */
export default function RoleGuard({ children, allowedRoles = [], allowedStaffTypes = [], allowedAdminTypes = [] }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Stable refs so inline array literals don't re-trigger the effect on every render
  const allowedRolesRef = useRef(allowedRoles);
  const allowedStaffTypesRef = useRef(allowedStaffTypes);
  const allowedAdminTypesRef = useRef(allowedAdminTypes);

  useEffect(() => {
    if (!loading) {
      const roles = allowedRolesRef.current;
      const staffTypes = allowedStaffTypesRef.current;
      const adminTypes = allowedAdminTypesRef.current;

      if (!user) {
        if (pathname.startsWith("/staff")) {
          router.replace("/staff");
        } else {
          router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
        }
      } else if (roles.length > 0 && !roles.includes(user.role)) {
        if (user.role === "staff") {
          router.replace(getStaffDestination(user));
        } else if (user.role === "dev") {
          router.replace("/cms/settings");
        } else if (["admin", "superadmin"].includes(user.role)) {
          router.replace("/cms/dashboard");
        } else {
          router.replace("/");
        }
      } else if (staffTypes.length > 0 && user.role === "staff" && !staffTypes.includes(user.staffType)) {
        router.replace(getStaffDestination(user));
      } else if (adminTypes.length > 0 && user.role === "admin" && !adminTypes.includes(user.adminType || "departmental")) {
        router.replace("/cms/dashboard");
      }
    }
  }, [user, loading, router, pathname]);

  const isRoleAllowed = allowedRoles.length === 0 || allowedRoles.includes(user?.role);
  const isStaffTypeAllowed = allowedStaffTypes.length === 0 || (user?.role === "staff" && allowedStaffTypes.includes(user?.staffType));
  const isAdminTypeAllowed = allowedAdminTypes.length === 0 || (user?.role === "admin" && allowedAdminTypes.includes(user?.adminType || "departmental"));
  const isBypassRole = user?.role === "superadmin" || user?.role === "dev";

  if (loading || !user || (!isBypassRole && (!isRoleAllowed || !isStaffTypeAllowed || !isAdminTypeAllowed))) {
    return <LoadingState />;
  }

  return children;
}
