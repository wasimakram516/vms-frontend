"use client";

export function canAccessResource(user, pageId, { hardcodeAllowed = false, action = 'read' } = {}) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  if (user.role === 'dev') return hardcodeAllowed;
  return Array.isArray(user.permissions) && user.permissions.includes(`${pageId}:${action}`);
}
