/**
 * Count a visitor's genuinely past registrations, excluding the one(s)
 * currently being approved. `allRegs` is the frontend serialized registration
 * list for that visitor (the pending one / any co-selected sibling is part of
 * that list, which is why it must be excluded).
 */
export function countPastVisits(allRegs, excludeIds) {
  if (!Array.isArray(allRegs)) return 0;
  const ids = excludeIds == null ? [] : Array.isArray(excludeIds) ? excludeIds : excludeIds instanceof Set ? [...excludeIds] : [excludeIds];
  const exclude = new Set(ids);
  return allRegs.filter((r) => !exclude.has(r?.id ?? r?._id)).length;
}

/**
 * Resolve the "past visits" breakdown for a registration being approved.
 * The registration currently being approved is NEVER counted for any member.
 *
 * - Single visit:  { isGroup: false, breakdown: [{ id, fullName, count }] }
 * - Group meeting: { isGroup: true,  breakdown: [one entry per participant] }
 *
 * `fetchRegistrations` is the getRegistrations service fn (injected to avoid a
 * service → util dependency).
 */
export async function resolvePastVisitBreakdown(target, fetchRegistrations) {
  if (!target) return { isGroup: false, breakdown: [] };
  const currentId = target?.id ?? target?._id ?? null;
  const participants = Array.isArray(target?.participants) ? target.participants : [];
  const isGroup = participants.length > 1;

  let members;
  if (isGroup) {
    members = participants
      .map((p) => ({
        id: p?.id || p?._id,
        fullName: p?.fullName || p?.name || "",
      }))
      .filter((m) => m.id);
  } else {
    const ownerId = target?.user_id || target?.userId;
    if (!ownerId) return { isGroup: false, breakdown: [] };
    members = [{ id: ownerId, fullName: target?.visitor?.fullName || "" }];
  }
  if (!members.length) return { isGroup, breakdown: [] };

  const breakdown = [];
  for (const m of members) {
    let regs = [];
    try {
      regs = await fetchRegistrations(null, {}, m.id);
    } catch {
      regs = [];
    }
    breakdown.push({
      id: m.id,
      fullName: m.fullName,
      count: countPastVisits(regs, currentId),
    });
  }
  return { isGroup, breakdown };
}