"use client";

export function isResourceManaged(user, resource) {
  return Array.isArray(user?.managedResources) && user.managedResources.includes(resource);
}

/**
 * Check if a user can access a resource+action.
 *
 * @param {object} user          - user from AuthContext (has .role, .permissions, .managedResources, .isSuper, .isDev)
 * @param {string} resource      - the resource key e.g. 'users', 'visits'
 * @param {object} opts
 * @param {boolean} opts.hardcodeAllowed - whether the existing hardcoded role/adminType rules allow this user
 * @param {string}  [opts.action]        - the action to check (default 'read')
 */
export function canAccessResource(user, resource, { hardcodeAllowed = false, action = 'read' } = {}) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  // Dev: permission layer never applies; use hardcode
  if (user.role === 'dev') return hardcodeAllowed;

  if (!isResourceManaged(user, resource)) return hardcodeAllowed;

  // Resource is managed → dynamic config is the source of truth
  return Array.isArray(user.permissions) && user.permissions.includes(`${resource}:${action}`);
}
