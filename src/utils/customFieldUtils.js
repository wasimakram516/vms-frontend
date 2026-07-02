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

export const ID_TYPE_ALIASES = [
    "idtype", "id type", "document type", "documenttype",
    "id category", "identity type", "id kind",
];

export const ID_ALIASES = [
    "civilid", "civil id", "omanid", "oman id", "national id", "nationalid",
    "id number", "idnumber", "idno", "id no", "passport", "passport number",
    "passportno", "passport no", "id card", "identity number", "eid",
    "civil id number", "oman civil id", "idcardnumber", "identificationnumber",
    "documentnumber",
];

export const PHONE_ALIASES = [
    "phone", "phone number", "mobile", "contact", "whatsapp",
    "visitor phone", "user phone",
];

export const FULL_NAME_ALIASES = [
    "fullname", "full name", "visitor name", "visitorname", "name",
    "full_name",
];

// ── Static Arabic translations for common VMS field labels and option values ──
// Matched case-insensitively. Add entries here as new field names appear in the system.
const COMMON_AR_TRANSLATIONS = {
    // ── Phone ──────────────────────────────────────────────────────────────────
    "phone":              "هاتف",
    "mobile":             "جوال",
    "mobile number":      "رقم الجوال",
    "phone number":       "رقم الهاتف",
    "contact":            "جهة الاتصال",
    "contact number":     "رقم جهة الاتصال",
    "whatsapp":           "واتساب",
    "visitor phone":      "هاتف الزائر",

    // ── ID type selector ───────────────────────────────────────────────────────
    "id type":            "نوع الهوية",
    "id category":        "فئة الهوية",
    "identity type":      "نوع الهوية",
    "document type":      "نوع المستند",
    "id kind":            "نوع الهوية",

    // ── ID field labels ────────────────────────────────────────────────────────
    "oman id":            "الهوية العُمانية",
    "omani id":           "الهوية العُمانية",
    "civil id":           "الهوية المدنية",
    "civil id number":    "رقم الهوية المدنية",
    "oman civil id":      "الهوية المدنية العُمانية",
    "national id":        "الهوية الوطنية",
    "id number":          "رقم الهوية",
    "id no":              "رقم الهوية",
    "passport":           "جواز السفر",
    "passport number":    "رقم جواز السفر",
    "passport no":        "رقم جواز السفر",
    "resident card":      "بطاقة الإقامة",
    "residency card":     "بطاقة الإقامة",
    "driving license":    "رخصة القيادة",
    "driver's license":   "رخصة القيادة",
    "drivers license":    "رخصة القيادة",
    "eid":                "الهوية الإلكترونية",
    "document number":    "رقم المستند",
    "identification number": "رقم التعريف",

    // ── Passport sub-fields ────────────────────────────────────────────────────
    "passport country":         "بلد جواز السفر",
    "country of issue":         "بلد الإصدار",
    "country of passport":      "بلد جواز السفر",
    "nationality":              "الجنسية",
    "issuing country":          "بلد الإصدار",

    // ── Visitor identity ───────────────────────────────────────────────────────
    "full name":          "الاسم الكامل",
    "name":               "الاسم",
    "first name":         "الاسم الأول",
    "last name":          "الاسم الأخير",
    "surname":            "اسم العائلة",
    "email":              "البريد الإلكتروني",
    "email address":      "عنوان البريد الإلكتروني",
    "date of birth":      "تاريخ الميلاد",
    "dob":                "تاريخ الميلاد",
    "gender":             "الجنس",
    "country":            "الدولة",
    "company":            "الشركة",
    "organization":       "المؤسسة",
    "job title":          "المسمى الوظيفي",
    "position":           "المنصب",

    // ── Visit fields ───────────────────────────────────────────────────────────
    "department":         "القسم",
    "purpose of visit":   "الغرض من الزيارة",
    "purpose":            "الغرض",
    "host":               "المضيف",
    "host name":          "اسم المضيف",
    "notes":              "ملاحظات",
    "remarks":            "ملاحظات",

    // ── Option values (select / radio / checkbox) ──────────────────────────────
    // Gender
    "male":               "ذكر",
    "female":             "أنثى",
    "other":              "أخرى",

    // Boolean
    "yes":                "نعم",
    "no":                 "لا",
};

/**
 * Return the Arabic translation for a common VMS field label or option value.
 * Matching is case-insensitive and trims whitespace.
 * Returns null if not found — caller should fall back to translateBatch.
 *
 * @param {string} text
 * @returns {string|null}
 */
export function getArLabel(text) {
    if (!text) return null;
    return COMMON_AR_TRANSLATIONS[String(text).trim().toLowerCase()] || null;
}

// ── Value pickers (operate on a { fieldKey: value } map) ─────────────────────

/** Extract the resolved ID value from a field-values map */
export const pickId = (f) => pick(f, "civilid", ID_ALIASES);

/** Extract the ID-type value (e.g. "Passport") from a field-values map */
export const pickIdType = (f) => pick(f, "idtype", ID_TYPE_ALIASES);

/** Extract the phone value from a field-values map */
export const pickPhone = (f) => pick(f, "phone", PHONE_ALIASES);

// ── Field-definition matcher ──────────────────────────────────────────────────

/**
 * Find a field definition from getFields() whose normalized fieldKey or label
 * matches any of the given alias strings.
 *
 * @param {Array}  fields  - array of field objects from getFields()
 * @param {Array}  aliases - alias strings (already normalized)
 * @returns {object|null}
 */
export function findFieldByAliases(fields, aliases) {
    if (!Array.isArray(fields) || !aliases?.length) return null;
    const candidateSet = new Set(aliases.map(normalize));
    return fields.find((f) => {
        const key = normalize(f.fieldKey || f.field_key || "");
        const label = normalize(f.label || "");
        return candidateSet.has(key) || candidateSet.has(label);
    }) || null;
}

// ── Dependent-field visibility engine ────────────────────────────────────────

/**
 * Safely extract child field IDs from a dependentsJson config value.
 * Handles both the old array format and the new { fieldIds, ... } object format.
 *
 * @param {Array|object} config
 * @returns {string[]}
 */
export function getChildFieldIds(config) {
    if (!config) return [];
    if (Array.isArray(config)) return config;
    return config.fieldIds || [];
}

/**
 * BFS engine: given the full field list and the current values map ({ fieldKey: value }),
 * return a Set of field IDs that should be visible. Top-level fields (not a child of any
 * dependentsJson entry) are always visible; children are revealed when their parent
 * carries the triggering value.
 *
 * @param {Array}  fields      - all field objects from getFields()
 * @param {object} values      - current { fieldKey: value } map
 * @returns {Set<string>}
 */
export function computeVisibleFieldIds(fields, values = {}) {
    if (!Array.isArray(fields)) return new Set();

    // Build a set of all field IDs that appear as dependents of any parent
    const allChildIds = new Set();
    fields.forEach((f) => {
        const deps = f.dependentsJson || f.dependents_json;
        if (deps) {
            Object.values(deps).forEach((config) => {
                getChildFieldIds(config).forEach((id) => allChildIds.add(id));
            });
        }
    });

    const fieldById = Object.fromEntries(fields.map((f) => [f.id, f]));
    const visible = new Set();
    const queue = [];

    // Seed with top-level (non-child) fields
    fields.forEach((f) => {
        if (!allChildIds.has(f.id)) {
            visible.add(f.id);
            queue.push(f);
        }
    });

    // BFS: enqueue triggered children
    while (queue.length > 0) {
        const current = queue.shift();
        const deps = current.dependentsJson || current.dependents_json;
        if (!deps) continue;
        const currentKey = current.fieldKey || current.field_key;
        const currentValue = values[currentKey];
        if (currentValue && deps[currentValue]) {
            getChildFieldIds(deps[currentValue]).forEach((childId) => {
                if (!visible.has(childId)) {
                    visible.add(childId);
                    const child = fieldById[childId];
                    if (child) queue.push(child);
                }
            });
        }
    }

    return visible;
}

/**
 * Recursively collect all field IDs reachable from a root field via dependentsJson,
 * regardless of which option is selected. Used to scope the visibility engine to
 * just the ID subtree.
 *
 * @param {object}  rootField
 * @param {Array}   allFields
 * @returns {Set<string>}
 */
export function collectSubtreeIds(rootField, allFields) {
    if (!rootField) return new Set();
    const fieldById = Object.fromEntries(allFields.map((f) => [f.id, f]));
    const result = new Set([rootField.id]);
    const queue = [rootField];
    while (queue.length > 0) {
        const current = queue.shift();
        const deps = current.dependentsJson || current.dependents_json;
        if (!deps) continue;
        Object.values(deps).forEach((config) => {
            getChildFieldIds(config).forEach((childId) => {
                if (!result.has(childId)) {
                    result.add(childId);
                    const child = fieldById[childId];
                    if (child) queue.push(child);
                }
            });
        });
    }
    return result;
}

/**
 * Clear values for children that are no longer triggered by a parent's new value.
 * Mutates the provided values object and recurses.
 *
 * @param {object} parentField
 * @param {string} newValue
 * @param {object} values        - mutable { fieldKey: value } map
 * @param {Array}  allFields
 */
export function clearHiddenChildren(parentField, newValue, values, allFields) {
    const deps = parentField?.dependentsJson || parentField?.dependents_json;
    if (!deps) return;
    Object.entries(deps).forEach(([triggerVal, config]) => {
        if (triggerVal !== newValue) {
            getChildFieldIds(config).forEach((childId) => {
                const childField = allFields.find((f) => f.id === childId);
                if (childField) {
                    const childKey = childField.fieldKey || childField.field_key;
                    const oldChildValue = values[childKey];
                    delete values[childKey];
                    clearHiddenChildren(childField, oldChildValue, values, allFields);
                }
            });
        }
    });
}

