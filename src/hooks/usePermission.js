"use client";

import { useAuth } from "@/contexts/AuthContext";
import { canAccessResource } from "@/utils/permissions";

/**
 * Returns true if the current user has the given resource+action permission.
 *
 * hardcodeAllowed should reflect whether the existing role/adminType rules
 * would allow this user — defaults to false (conservative).
 */
export function useHasPermission(resource, { action = "read", hardcodeAllowed = false } = {}) {
  const { user } = useAuth();
  return canAccessResource(user, resource, { hardcodeAllowed, action });
}
