// Display helper for registrations: group meetings have userId null (members in
// participants), so they fall back to "N/A" via full_name. Provide a label that
// actually names the group members instead.
export const getGroupMemberNames = (reg) => {
  if (!Array.isArray(reg?.participants)) return [];
  return reg.participants
    .map((p) => p?.fullName)
    .filter((n) => typeof n === "string" && n.trim() !== "");
};

export const getRegistrationDisplayName = (reg, fallback = "Visitor") => {
  const members = getGroupMemberNames(reg);
  if (members.length > 1) return `Group Meeting (${members.join(", ")})`;
  return (
    reg?.full_name ||
    reg?.fullName ||
    reg?.user?.fullName ||
    reg?.user?.full_name ||
    fallback
  );
};

export const getRegistrationDisplayInitial = (reg, fallback = "?") => {
  const members = getGroupMemberNames(reg);
  const name =
    (members[0]?.fullName || reg?.full_name || reg?.fullName || "").trim() ||
    fallback;
  return name.charAt(0).toUpperCase();
};