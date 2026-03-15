"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Stack,
    MenuItem,
    RadioGroup,
    FormControlLabel,
    Radio,
    FormControl,
    InputLabel,
    Select,
    Box,
    Typography,
    FormHelperText,
    CircularProgress,
} from "@mui/material";
import ICONS from "@/utils/iconUtil";
import getStartIconSpacing from "@/utils/getStartIconSpacing";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import { DEFAULT_COUNTRY_CODE, DEFAULT_ISO_CODE, COUNTRY_CODES, getCountryCodeByIsoCode } from "@/utils/countryCodes";
import { normalizePhone } from "@/utils/phoneUtils";
import { validatePhoneNumber } from "@/utils/phoneValidation";


export default function RegistrationModal({
    open,
    onClose,
    registration,
    formFields,
    onSave,
    mode = "edit",
    title,
    event,
}) {
    const [values, setValues] = useState({});
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [countryIsoCodes, setCountryIsoCodes] = useState({});

    const hasCustomFields = useMemo(() => formFields && formFields.length > 0, [formFields]);

    const filteredFormFields = useMemo(() => {
        if (!formFields || !formFields.length) return [];
        return formFields.filter((f) => f.visible !== false);
    }, [formFields]);

    const classicFields = useMemo(
        () => [
            { inputName: "Full Name", inputType: "text", required: true },
            { inputName: "Email", inputType: "email", required: true },
            { inputName: "Phone", inputType: "text", required: false },
            { inputName: "Company", inputType: "text", required: false },
        ],
        []
    );

    const fieldsToRender = useMemo(
        () => (hasCustomFields ? filteredFormFields : classicFields),
        [hasCustomFields, filteredFormFields, classicFields]
    );

    useEffect(() => {
        if (fieldsToRender.length > 0) {
            const init = {};
            const initCountryIsoCodes = {};
            if (registration && mode === "edit") {
                fieldsToRender.forEach((f) => {
                    if (hasCustomFields) {
                        init[f.inputName] =
                            registration.customFields?.[f.inputName] ||
                            registration[f.inputName] ||
                            "";
                    } else {
                        const fieldMap = {
                            "Full Name": registration.fullName,
                            Email: registration.email,
                            Phone: registration.phone,
                            Company: registration.company,
                        };
                        init[f.inputName] = fieldMap[f.inputName] || "";
                    }
                    if (isPhoneField(f)) {
                        const phoneValue = init[f.inputName] || "";
                        const regIsoCode = registration?.isoCode;
                        if (regIsoCode) {
                            initCountryIsoCodes[f.inputName] = regIsoCode.toLowerCase();
                        } else if (phoneValue.startsWith("+")) {
                            let foundCountry = null;
                            let longestMatch = "";
                            for (const country of COUNTRY_CODES) {
                                if (phoneValue.startsWith(country.code)) {
                                    if (country.code.length > longestMatch.length) {
                                        longestMatch = country.code;
                                        foundCountry = country;
                                    }
                                }
                            }
                            if (foundCountry) {
                                initCountryIsoCodes[f.inputName] = foundCountry.isoCode;
                                init[f.inputName] = phoneValue.substring(foundCountry.code.length).trim();
                            } else {
                                initCountryIsoCodes[f.inputName] = DEFAULT_ISO_CODE;
                            }
                        } else {
                            initCountryIsoCodes[f.inputName] = DEFAULT_ISO_CODE;
                        }
                    }
                });
            } else {
                fieldsToRender.forEach((f) => {
                    init[f.inputName] = "";
                    if (isPhoneField(f)) {
                        initCountryIsoCodes[f.inputName] = DEFAULT_ISO_CODE;
                    }
                });
            }
            setValues(init);
            setCountryIsoCodes(initCountryIsoCodes);
            setFieldErrors({});
            setLoading(false);
        }
    }, [registration, fieldsToRender, hasCustomFields, mode, open, registration?.isoCode]);

    const handleChange = (key, value) => {
        setValues((prev) => ({ ...prev, [key]: value }));
        if (fieldErrors[key]) {
            setFieldErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[key];
                return newErrors;
            });
        }
    };

    const handleCountryCodeChange = (fieldName, isoCode) => {
        setCountryIsoCodes((prev) => ({ ...prev, [fieldName]: isoCode }));
    };

    const handlePhoneChange = (fieldName, value) => {
        const digitsOnly = value.replace(/\D/g, "");
        setValues((prev) => ({ ...prev, [fieldName]: digitsOnly }));
        if (fieldErrors[fieldName]) {
            setFieldErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[fieldName];
                return newErrors;
            });
        }
    };

    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const isPhoneField = (field) => {
        if (field.inputType === "number") return false;
        if (field.inputType === "phone") return true;
        if (!hasCustomFields && field.inputName === "Phone") return true;
        return false;
    };


    const validateFields = () => {
        const errors = {};
        fieldsToRender.forEach((f) => {
            const rawValue = values[f.inputName];
            const val = rawValue != null ? String(rawValue).trim() : "";
            const required = f.required || false;

            if (required && !val) {
                errors[f.inputName] = `${f.inputName} is required`;
            }

            if ((f.inputType === "email" || f.inputName === "Email") && val && !isValidEmail(val)) {
                errors[f.inputName] = "Invalid email address";
            }

            if (isPhoneField(f) && val) {
                const isoCode = countryIsoCodes[f.inputName] || DEFAULT_ISO_CODE;
                const phoneError = validatePhoneNumber(val, isoCode);
                if (phoneError) {
                    errors[f.inputName] = phoneError;
                }
            }
        });

        return errors;
    };

    const handleSave = async () => {
        const errors = validateFields();
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        setLoading(true);
        try {
            const normalizedValues = { ...values };
            let phoneIsoCode = null;

            fieldsToRender.forEach((f) => {
                if (isPhoneField(f)) {
                    const phoneValue = normalizedValues[f.inputName];
                    if (phoneValue) {
                        const isoCode = countryIsoCodes[f.inputName] || DEFAULT_ISO_CODE;
                        const country = getCountryCodeByIsoCode(isoCode);
                        const countryCode = country?.code || DEFAULT_COUNTRY_CODE;
                        const fullPhone = phoneValue.startsWith("+")
                            ? phoneValue
                            : `${countryCode}${phoneValue}`;
                        const normalized = normalizePhone(fullPhone);

                        phoneIsoCode = isoCode;

                        normalizedValues[f.inputName] = phoneValue.trim();
                    }
                }
            });

            if (phoneIsoCode) {
                normalizedValues.isoCode = phoneIsoCode;
            }

            await onSave(normalizedValues);
        } finally {
            setLoading(false);
        }
    };

    const renderField = (f) => {
        const value = values[f.inputName] ?? "";
        const required = f.required || false;
        const errorMsg = fieldErrors[f.inputName];

        if (f.inputType === "radio") {
            return (
                <Box key={f.inputName} sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        {f.inputName}
                        {required && <span style={{ color: "red" }}> *</span>}
                    </Typography>
                    <RadioGroup
                        row
                        name={f.inputName}
                        value={value}
                        onChange={(e) => handleChange(f.inputName, e.target.value)}
                    >
                        {f.values?.map((opt) => (
                            <FormControlLabel
                                key={`${f.inputName}-${opt}`}
                                value={opt}
                                control={<Radio size="small" />}
                                label={opt}
                            />
                        ))}
                    </RadioGroup>
                    {errorMsg && (
                        <FormHelperText error sx={{ mt: 0.5 }}>
                            {errorMsg}
                        </FormHelperText>
                    )}
                </Box>
            );
        }

        if (["list", "select", "dropdown"].includes(f.inputType)) {
            return (
                <FormControl key={f.inputName} fullWidth size="small" required={required} error={!!errorMsg}>
                    <InputLabel>{f.inputName}</InputLabel>
                    <Select
                        value={value}
                        onChange={(e) => handleChange(f.inputName, e.target.value)}
                        label={f.inputName}
                    >
                        {f.values?.map((opt) => (
                            <MenuItem key={opt} value={opt}>
                                {opt}
                            </MenuItem>
                        ))}
                    </Select>
                    {errorMsg && <FormHelperText>{errorMsg}</FormHelperText>}
                </FormControl>
            );
        }

        if (f.inputType === "number") {
            return (
                <TextField
                    key={f.inputName}
                    label={f.inputName}
                    value={value}
                    onChange={(e) => handleChange(f.inputName, e.target.value)}
                    fullWidth
                    size="small"
                    required={required}
                    error={!!errorMsg}
                    helperText={errorMsg}
                    type="number"
                />
            );
        }

        const isPhoneField = f.inputType === "phone" || (!hasCustomFields && f.inputName === "Phone");
        const useInternationalNumbers = event?.useInternationalNumbers !== false;

        if (isPhoneField) {
            const isoCode = countryIsoCodes[f.inputName] || DEFAULT_ISO_CODE;
            const phoneValue = value || "";

            return (
                <TextField
                    key={f.inputName}
                    label={f.inputName}
                    value={phoneValue}
                    onChange={(e) => handlePhoneChange(f.inputName, e.target.value)}
                    fullWidth
                    size="small"
                    required={required}
                    error={!!errorMsg}
                    helperText={errorMsg || "Enter your phone number"}
                    type="tel"
                    InputProps={{
                        startAdornment: (
                            <CountryCodeSelector
                                value={isoCode}
                                onChange={(iso) => handleCountryCodeChange(f.inputName, iso)}
                                disabled={!useInternationalNumbers}
                                dir="ltr"
                            />
                        ),
                    }}
                />
            );
        }

        return (
            <TextField
                key={f.inputName}
                label={f.inputName}
                value={value}
                onChange={(e) => handleChange(f.inputName, e.target.value)}
                fullWidth
                size="small"
                required={required}
                error={!!errorMsg}
                helperText={errorMsg}
                type={f.inputType === "number" ? "number" : f.inputType === "email" ? "email" : "text"}
            />
        );
    };

    const displayTitle = title || (mode === "create" ? "Create Registration" : "Edit Registration");
    const saveButtonText = mode === "create" ? "Create" : "Save Changes";

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{displayTitle}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} mt={1}>
                    {fieldsToRender.map((f) => renderField(f))}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button
                    variant="outlined"
                    onClick={onClose}
                    disabled={loading}
                    startIcon={<ICONS.cancel />}
                    sx={getStartIconSpacing("ltr")}
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSave}
                    disabled={loading}
                    startIcon={
                        loading ? (
                            <CircularProgress size={18} color="inherit" />
                        ) : (
                            <ICONS.save />
                        )
                    }
                    sx={getStartIconSpacing("ltr")}
                >
                    {saveButtonText}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

