"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import LoadingState from "@/components/LoadingState";

/**
 * RoleGuard Component
 * @param {Object} props
 * @param {Array<string>} props.allowedRoles - User roles to allow (e.g., ["admin", "staff"])
 * @param {Array<string>} props.allowedStaffTypes - Staff types to allow (e.g., ["gate", "kitchen"])
 */
export default function RoleGuard({ children, allowedRoles = [], allowedStaffTypes = [] }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        if (pathname.startsWith("/staff")) {
          router.replace("/staff");
        } else {
          router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
        }
      } else if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        if (user.role === "staff") {
          router.replace("/staff/gate/verify");
        } else if (["admin", "superadmin"].includes(user.role)) {
          router.replace("/cms/dashboard");
        } else {
          router.replace("/");
        }
      } else if (allowedStaffTypes.length > 0 && user.role === "staff" && !allowedStaffTypes.includes(user.staffType)) {
        if (user.staffType === "kitchen") {
          router.replace("/staff/kitchen");
        } else {
          router.replace("/staff/gate/verify");
        }
      }
    }
  }, [user, loading, allowedRoles, allowedStaffTypes, router, pathname]);

  if (loading || !user || (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) || (allowedStaffTypes.length > 0 && user.role === "staff" && !allowedStaffTypes.includes(user.staffType))) {
    return <LoadingState />;
  }

  return children;
}
