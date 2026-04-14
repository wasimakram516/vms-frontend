export const normalizePhone = (phone) => {
    if (!phone) return null;

    return String(phone)
        .trim()
        .replace(/\s+/g, "")
        .replace(/[()-]/g, "");
};

export const filterPhoneInput = (val) => {
    if (!val) return "";
    return String(val).replace(/\D/g, "");
};

export const filterNumberInput = filterPhoneInput;

export const onKeyPressPhone = (e) => {
    if (!/[0-9]/.test(e.key)) {
        e.preventDefault();
    }
};

export const onKeyPressNumeric = onKeyPressPhone;

