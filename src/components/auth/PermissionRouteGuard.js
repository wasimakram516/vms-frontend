"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import LoadingState from "@/components/LoadingState";
import { canAccessResource } from "@/utils/permissions";

/**
 * PermissionRouteGuard — placed INSIDE RoleGuard.
 * Redirects to /cms/dashboard if the user lacks access to this resource.
 *
 * @param {string}  resource        - e.g. 'users', 'visits'
 * @param {string}  [action]        - default 'read'
 * @param {boolean} [hardcodeAllowed] - whether the hardcoded role/adminType rules already allow this user
 */
export default function PermissionRouteGuard({
  children,
  resource,
  action = "read",
  hardcodeAllowed = false,
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const allowed = canAccessResource(user, resource, { hardcodeAllowed, action });

  useEffect(() => {
    if (!loading && user && !allowed) {
      router.replace("/cms/dashboard");
    }
  }, [loading, user, allowed, router, pathname]);

  if (loading || !user || !allowed) {
    return <LoadingState />;
  }

  return children;
}
