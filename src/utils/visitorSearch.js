/**
 * Client-side predicate used by the CMS Visitors list. Matches a visitor
 * against a free-text query across the identity fields staff search on:
 * full name, email, phone, and the ID card number (both the account-level
 * idNo and the history-derived _idValue).
 */
export function visitorMatchesQuery(visitor, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return [visitor?.fullName, visitor?.email, visitor?.phone, visitor?.idNo, visitor?._idValue]
    .some((value) => value != null && String(value).toLowerCase().includes(q));
}