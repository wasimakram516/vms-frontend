/**
 * Client-side mirror of the backend plain-text rules in
 * `Sinan-VMS-Backend/src/common/security/safe-text.util.ts` and
 * `registration-field-validation.service.ts`. The backend remains the
 * authority; this only gives visitors the same message before submitting.
 * Keep patterns, limits, and wording in sync with the backend.
 */

/** Markup, entity-encoded angle brackets, script URLs, and inline handlers. */
export const UNSAFE_TEXT_PATTERN =
  /[<>]|&(?:lt|gt|#0*60|#x0*3c);|\b(?:javascript|vbscript)\s*:|\bdata\s*:\s*text\/html|\bon[a-z]+\s*=/i;

/** C0 control characters other than tab, line feed, and carriage return. */
export const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Maximum lengths per custom-field input type (backend enforced). */
export const FIELD_MAX_LENGTHS = Object.freeze({
  text: 200,
  textarea: 2000,
  email: 254,
  phone: 25,
  number: 30,
  select: 200,
  radio: 200,
  checkbox: 200,
});

export const DEFAULT_MAX_LENGTH = FIELD_MAX_LENGTHS.text;

/** True when a string contains no markup or executable content after NFKC folding. */
export const isSafePlainText = (value) => {
  const normalized = String(value).normalize("NFKC");
  return (
    !UNSAFE_TEXT_PATTERN.test(normalized) &&
    !CONTROL_CHARACTER_PATTERN.test(normalized)
  );
};

export const unsafeTextMessage = (label) =>
  `${label} cannot contain markup or code, such as < or > characters`;

export const tooLongMessage = (label, maxLength) =>
  `${label} must be at most ${maxLength} characters`;

/**
 * Validate one plain-text value against the markup rule and a length limit.
 * @param {unknown} value - Submitted value; non-strings are ignored.
 * @param {string} label - Field label used in the message.
 * @param {number} [maxLength] - Maximum length after trimming.
 * @returns {string|null} Error message, or null when the value is acceptable.
 */
export const validateSafeText = (value, label, maxLength = DEFAULT_MAX_LENGTH) => {
  if (typeof value !== "string" || !value.trim()) return null;
  if (!isSafePlainText(value)) return unsafeTextMessage(label);
  if (value.normalize("NFKC").trim().length > maxLength) {
    return tooLongMessage(label, maxLength);
  }
  return null;
};

/**
 * Convert legacy rich-text HTML (older textarea values were saved from a rich
 * editor) into plain text so it passes the markup rule on resubmission.
 * Block boundaries become line breaks; tags and entities are removed.
 * @param {unknown} value
 * @returns {unknown} Plain text for strings containing tags; other values unchanged.
 */
export const htmlToPlainText = (value) => {
  if (typeof value !== "string" || !/[<>]|&[a-z#0-9]+;/i.test(value)) return value;
  const withBreaks = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, "\n");
  const text =
    typeof DOMParser === "undefined"
      ? withBreaks.replace(/<[^>]*>/g, "")
      : new DOMParser().parseFromString(withBreaks, "text/html").body.textContent || "";
  return text
    .replace(/[<>]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

