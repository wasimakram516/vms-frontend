import { validatePhoneNumber } from "./phoneValidation";
import { DEFAULT_MAX_LENGTH, FIELD_MAX_LENGTHS, validateSafeText } from "./safeText";

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isPhoneField = (field) => {
  if (field.inputType === "number") return false;
  if (field.inputType === "phone") return true;
  return false;
};

export const validateRequired = (value, fieldName) => {
  const val = value != null ? String(value).trim() : "";
  if (!val) {
    return `${fieldName} is required`;
  }
  return null;
};

export const validateEmail = (value, fieldName) => {
  if (value && !isValidEmail(value)) {
    return "Invalid email address";
  }
  return null;
};

export const validateSelectValue = (value, allowedValues, fieldName) => {
  if (value && allowedValues && !allowedValues.includes(value)) {
    return `Invalid value. Allowed: ${allowedValues.join(", ")}`;
  }
  return null;
};

const NUMBER_PATTERN = /^-?\d+(?:\.\d+)?$/;

export const validateNumber = (value, fieldName) => {
  if (value === "" || value == null) return null;
  if (!NUMBER_PATTERN.test(String(value).trim())) {
    return `${fieldName || "Value"} must be a number`;
  }
  return null;
};

export const validatePhone = (value, isoCode) => {
  if (!value) return null;
  return validatePhoneNumber(value, isoCode);
};

export const validateMinLength = (value, minLength, fieldName) => {
  const val = value != null ? String(value).trim() : "";
  if (val && val.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }
  return null;
};

export const validateMaxLength = (value, maxLength, fieldName) => {
  const val = value != null ? String(value).trim() : "";
  if (val && val.length > maxLength) {
    return `${fieldName} must be at most ${maxLength} characters`;
  }
  return null;
};

export const validatePattern = (value, pattern, fieldName, message) => {
  if (value && !pattern.test(value)) {
    return message || `${fieldName} format is invalid`;
  }
  return null;
};

export const validateUrl = (value, fieldName) => {
  if (!value) return null;
  const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
  if (!urlPattern.test(value)) {
    return `${fieldName} must be a valid URL`;
  }
  return null;
};

export const validateDate = (value, fieldName) => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(normalized) ||
    isNaN(new Date(`${normalized}T00:00:00Z`).getTime())
  ) {
    return `${fieldName} must be a valid date (YYYY-MM-DD)`;
  }
  return null;
};

export const validateTime = (value, fieldName) => {
  if (!value) return null;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value).trim())) {
    return `${fieldName} must be a valid time (HH:mm)`;
  }
  return null;
};

export const validateCountry = (value, fieldName) => {
  if (!value) return null;
  if (!/^[A-Za-z]{2}$/.test(String(value).trim())) {
    return `${fieldName} must be a valid 2-letter country code`;
  }
  return null;
};

export const validateCheckboxValues = (value, allowedValues, fieldName) => {
  if (value == null || value === "") return null;
  const items = Array.isArray(value) ? value : [value];
  if (
    new Set(items).size !== items.length ||
    (allowedValues && items.some((item) => !allowedValues.includes(item)))
  ) {
    return `${fieldName}: please choose one of the available options`;
  }
  return null;
};

/** Input types whose values are never plain text shown back to staff. */
const SAFE_TEXT_EXEMPT_TYPES = new Set(["password", "file"]);

/**
 * Apply the backend markup rule and per-type length limit to a field value,
 * including every item of a multi-value (checkbox) field.
 */
export const validateFieldText = (field, value) => {
  const inputType = String(field.inputType || "text").toLowerCase();
  if (SAFE_TEXT_EXEMPT_TYPES.has(inputType)) return null;
  const label = field.label || field.inputName || "This field";
  const maxLength = FIELD_MAX_LENGTHS[inputType] ?? DEFAULT_MAX_LENGTH;
  const items = Array.isArray(value) ? value : [value];
  for (const item of items) {
    const err = validateSafeText(item, label, maxLength);
    if (err) return err;
  }
  return null;
};

export const validateField = (field, value, options = {}) => {
  const { isoCode, countryIsoCodes } = options;
  const errors = [];

  if (field.required) {
    const err = validateRequired(value, field.label || field.inputName);
    if (err) errors.push(err);
  }

  const textError = validateFieldText(field, value);
  if (textError) errors.push(textError);

  if (field.inputType === "email" || field.inputName?.toLowerCase().includes("email")) {
    const err = validateEmail(value, field.label || field.inputName);
    if (err) errors.push(err);
  }

  if (["radio", "list", "select", "dropdown"].includes(field.inputType)) {
    const err = validateSelectValue(value, field.values, field.label || field.inputName);
    if (err) errors.push(err);
  }

  const isPassportField = (field.label || "").toLowerCase().includes("passport") || 
                          (field.inputName || "").toLowerCase().includes("passport");

  if (field.inputType === "number" && !isPassportField) {
    const err = validateNumber(value, field.label || field.inputName);
    if (err) errors.push(err);
  }

  if (isPhoneField(field)) {
    const fieldIsoCode = isoCode || countryIsoCodes?.[field.inputName];
    const err = validatePhone(value, fieldIsoCode);
    if (err) errors.push(err);
  }

  if (field.inputType === "url") {
    const err = validateUrl(value, field.label || field.inputName);
    if (err) errors.push(err);
  }

  if (field.inputType === "date") {
    const err = validateDate(value, field.label || field.inputName);
    if (err) errors.push(err);
  }

  if (field.inputType === "time") {
    const err = validateTime(value, field.label || field.inputName);
    if (err) errors.push(err);
  }

  if (field.inputType === "country") {
    const err = validateCountry(value, field.label || field.inputName);
    if (err) errors.push(err);
  }

  if (field.inputType === "checkbox") {
    const err = validateCheckboxValues(value, field.values, field.label || field.inputName);
    if (err) errors.push(err);
  }

  if (field.minLength) {
    const err = validateMinLength(value, field.minLength, field.label || field.inputName);
    if (err) errors.push(err);
  }

  if (field.maxLength) {
    const err = validateMaxLength(value, field.maxLength, field.label || field.inputName);
    if (err) errors.push(err);
  }

  if (field.pattern) {
    const pattern = new RegExp(field.pattern);
    const err = validatePattern(value, pattern, field.label || field.inputName, field.patternMessage);
    if (err) errors.push(err);
  }

  return errors.length > 0 ? errors[0] : null;
};

const normalizeFieldKey = (key = "") => String(key).toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Apply the markup and length rules to every value of a custom-field map, using
 * each field's configured type and label. Used by edit forms that submit a
 * whole `fieldValues` object rather than validating one rendered input.
 * @param {Array<object>} customFields - Field definitions (camelCase or snake_case).
 * @param {Record<string, unknown>} values - Submitted field values keyed by field key.
 * @returns {Record<string, string>} Error message per offending key (empty when valid).
 */
export const validateCustomFieldValues = (customFields = [], values = {}) => {
  const fieldsByKey = new Map(
    customFields.map((f) => [normalizeFieldKey(f.fieldKey || f.field_key), f]),
  );
  const errors = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    const field = fieldsByKey.get(normalizeFieldKey(key));
    const error = validateFieldText(
      {
        inputName: key,
        inputType: field?.inputType || field?.input_type || "text",
        label: field?.label || key,
      },
      value,
    );
    if (error) errors[key] = error;
  });
  return errors;
};

/** Return the first message from an error map, or null. */
export const firstError = (errors) => Object.values(errors || {})[0] || null;

export const validateForm = (fields, values, options = {}) => {
  const errors = {};
  
  fields.forEach((field) => {
    const value = values[field.inputName];
    const error = validateField(field, value, options);
    if (error) {
      errors[field.inputName] = error;
    }
  });

  return errors;
};

export default {
  isValidEmail,
  isPhoneField,
  validateRequired,
  validateEmail,
  validateSelectValue,
  validateNumber,
  validatePhone,
  validateMinLength,
  validateMaxLength,
  validatePattern,
  validateUrl,
  validateDate,
  validateTime,
  validateCountry,
  validateCheckboxValues,
  validateFieldText,
  validateCustomFieldValues,
  firstError,
  validateField,
  validateForm,
};
