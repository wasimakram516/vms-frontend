"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import LoadingState from "@/components/LoadingState";
import { canAccessResource } from "@/utils/permissions";

/**
 * PermissionRouteGuard — placed INSIDE RoleGuard.
 * Redirects to /cms/dashboard if the user lacks access to this page.
 *
 * @param {string}  resource        - pageId e.g. 'users', 'visits'
 * @param {string}  [action]        - default 'read'
 * @param {boolean} [hardcodeAllowed] - fallback for dev role
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

  // Kitchen Admin: redirect to the page they have access to, never to /cms/dashboard
  const isKitchenAdmin = user?.role === "admin" && (user?.adminType || "departmental") === "kitchen";
  let redirectPath = "/cms/dashboard";
  if (isKitchenAdmin) {
    if (canAccessResource(user, "kitchen")) {
      redirectPath = "/cms/kitchen";
    } else {
      redirectPath = "/cms/settings/kitchen-menu";
    }
  }

  useEffect(() => {
    if (!loading && user && !allowed) {
      router.replace(redirectPath);
    }
  }, [loading, user, allowed, router, pathname, redirectPath]);

  if (loading || !user || !allowed) {
    return <LoadingState />;
  }

  return children;
}
