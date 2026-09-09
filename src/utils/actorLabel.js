/**
 * Build a human-readable actor label for activity-log timeline entries.
 * Combines the denormalized actor name with the actor's role + staff/admin
 * type so the timeline shows WHO performed the action and in what capacity.
 */
export function getActorRoleLabel(role, staffType, adminType) {
  if (!role) return null;
  const map = {
    superadmin: "SuperAdmin",
    dev: "Dev",
    admin:
      adminType === "kitchen"
        ? "Kitchen Admin"
        : adminType === "departmental"
          ? "Department Admin"
          : "Admin",
    staff:
      staffType === "kitchen"
        ? "Kitchen Staff"
        : staffType === "gate"
          ? "Gate Staff"
          : "Staff",
    visitor: "Visitor",
    investor: "Investor",
    organizer: "Organizer",
  };
  return map[role] || role;
}

/**
 * Extract `{ name, roleLabel }` from an activity log entry. `name` falls back
 * to the denormalized actorName (survives user deletion); returns null when
 * neither the actor nor a role is recorded (e.g. system-generated entries).
 */
export function formatActorLabel(log) {
  if (!log) return null;
  const actorUser = log.actorUser || log.actor_user || null;
  const name =
    actorUser?.fullName || actorUser?.full_name || log.actorName || log.actor_name || null;
  const roleLabel = getActorRoleLabel(
    actorUser?.role || log.actorRole || log.actor_role,
    actorUser?.staffType || log.actorStaffType,
    actorUser?.adminType || log.actorAdminType,
  );
  if (!name && !roleLabel) return null;
  return { name, roleLabel };
}