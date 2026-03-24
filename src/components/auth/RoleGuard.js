"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import LoadingState from "@/components/LoadingState";

/**
 * RoleGuard Component
 * @param {Object} props
 * @param {Array<string>} props.allowedRoles
 */
export default function RoleGuard({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
      } else if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        if (user.role === "staff") {
          router.replace("/staff/gate/verify");
        } else if (["admin", "superadmin"].includes(user.role)) {
          router.replace("/cms/dashboard");
        } else {
          router.replace("/");
        }
      }
    }
  }, [user, loading, allowedRoles, router, pathname]);

  if (loading || !user || (allowedRoles.length > 0 && !allowedRoles.includes(user.role))) {
    return <LoadingState />;
  }

  return children;
}
