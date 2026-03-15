/**
 * Utility functions to extract common fields from customFields objects
 * Used for registrations with custom form fields
 */

function normalize(str = "") {
    return String(str).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(customFields, matchKey, extraKeys = []) {
    if (!customFields || typeof customFields !== "object") return null;

    const target = normalize(matchKey);
    const candidates = new Set([target, ...extraKeys.map(normalize)]);

    for (const [origKey, val] of Object.entries(customFields)) {
        const nk = normalize(origKey);
        if (candidates.has(nk)) return val;
    }
    return null;
}

export function pickFullName(fields) {
    if (!fields) return null;

    // Try "Full Name" first
    const fn = pick(fields, "fullname", ["full name", "name"]);
    if (fn) return String(fn).trim();

    // Otherwise try First + Last
    const first =
        pick(fields, "firstname", ["first name", "given name"]) || null;
    const last =
        pick(fields, "lastname", ["last name", "surname"]) || null;

    const combined = [first, last].filter(Boolean).join(" ").trim();
    return combined || null;
}

export const pickEmail = (f) => pick(f, "email", ["e-mail", "email address"]);

