export const normalizePhone = (phone) => {
    if (!phone) return null;

    return String(phone)
        .trim()
        .replace(/\s+/g, "")
        .replace(/[()-]/g, "");
};

export const validatePhoneNumber = (phone) => {
    const phoneStr = normalizePhone(phone);
    if (!phoneStr) {
        return { valid: false, error: "Phone number is required" };
    }

    if (!phoneStr.startsWith("+")) {
        return { valid: false, error: "Phone must start with country code" };
    }

    const digits = phoneStr.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
        return { valid: false, error: "Invalid phone number length" };
    }

    return { valid: true, normalized: phoneStr };
};

