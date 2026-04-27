import { validatePhoneNumber } from "./phoneValidation";

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

export const validateNumber = (value, fieldName) => {
  if (value && isNaN(Number(value))) {
    return "Must be a valid number";
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
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return `${fieldName} must be a valid date`;
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

  if (field.inputType === "date" || field.inputType === "datetime") {
    const err = validateDate(value, field.label || field.inputName);
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
  validateField,
  validateForm,
};
