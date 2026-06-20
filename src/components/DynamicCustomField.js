"use client";

import {
    Box,
    Checkbox,
    FormControl,
    FormControlLabel,
    FormGroup,
    FormHelperText,
    FormLabel,
    InputLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    TextField,
    Typography,
} from "@mui/material";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import CountryPicker from "@/components/CountryPicker";
import { DEFAULT_ISO_CODE } from "@/utils/countryCodes";
import { filterPhoneInput, filterNumberInput, onKeyPressNumeric, onKeyPressPhone } from "@/utils/phoneUtils";

/**
 * Renders a single custom field (from getFields()) by its inputType.
 * Covers: select, radio, checkbox, phone, country, text/number/date/time/email, and
 * passport-country detection → CountryPicker.
 *
 * File, textarea, and rich-text types are intentionally excluded — they are not
 * needed in the returning-visitor ID flow.
 *
 * @param {object}   field             - field definition from getFields()
 * @param {*}        value             - current field value
 * @param {string}   error             - validation error message (or "")
 * @param {boolean}  isRequired        - true if required (includes forced-required by parent)
 * @param {Function} onChange          - onChange(fieldKey, newValue)
 * @param {string}   phoneIsoCode      - ISO code for phone fields (e.g. "OM")
 * @param {Function} onPhoneIsoChange  - onPhoneIsoChange(fieldKey, isoCode)
 * @param {string}   lang              - "en" | "ar" for CountryPicker
 */
export default function DynamicCustomField({
    field = null,
    value = "",
    error = "",
    isRequired = false,
    onChange = () => {},
    phoneIsoCode = DEFAULT_ISO_CODE,
    onPhoneIsoChange = () => {},
    lang = "en",
    translatedLabel = "",   // Arabic label override (empty = use field.label)
    translatedOptions = {}, // { [originalOpt]: translatedOpt } for select/radio/checkbox
}) {
    if (!field) return null;

    const fieldKey = field.fieldKey || field.field_key || "";
    const label = translatedLabel || field.label || fieldKey;
    const inputType = (field.inputType || field.input_type || "text").toLowerCase();
    const options = field.optionsJson || field.options_json || [];
    const fieldKeyLower = fieldKey.toLowerCase();
    // Always use the original English label for keyword detection — translatedLabel may be Arabic
    const fieldLabelLower = (field.label || fieldKey).toLowerCase();

    if (inputType === "select") {
        return (
            <FormControl fullWidth error={Boolean(error)} required={isRequired}>
                <InputLabel>{label}</InputLabel>
                <Select
                    value={value || ""}
                    label={label}
                    onChange={(e) => onChange(fieldKey, e.target.value)}
                    sx={{ borderRadius: 30 }}
                >
                    {options.map((opt) => (
                        <MenuItem key={opt} value={opt}>
                            {translatedOptions[opt] || opt}
                        </MenuItem>
                    ))}
                </Select>
                {error && <FormHelperText>{error}</FormHelperText>}
            </FormControl>
        );
    }

    if (inputType === "radio") {
        return (
            <FormControl error={Boolean(error)} required={isRequired}>
                <FormLabel>{label}</FormLabel>
                <RadioGroup
                    row
                    value={value || ""}
                    onChange={(e) => onChange(fieldKey, e.target.value)}
                >
                    {options.map((opt) => (
                        <FormControlLabel
                            key={opt}
                            value={opt}
                            control={<Radio />}
                            label={translatedOptions[opt] || opt}
                        />
                    ))}
                </RadioGroup>
                {error && <FormHelperText>{error}</FormHelperText>}
            </FormControl>
        );
    }

    if (inputType === "checkbox") {
        const checkVals = Array.isArray(value) ? value : (value ? [value] : []);
        return (
            <FormControl error={Boolean(error)} required={isRequired}>
                <FormLabel>{label}</FormLabel>
                <FormGroup row>
                    {options.map((opt) => (
                        <FormControlLabel
                            key={opt}
                            control={
                                <Checkbox
                                    checked={checkVals.includes(opt)}
                                    onChange={(e) => {
                                        const next = e.target.checked
                                            ? [...checkVals, opt]
                                            : checkVals.filter((v) => v !== opt);
                                        onChange(fieldKey, next);
                                    }}
                                />
                            }
                            label={translatedOptions[opt] || opt}
                        />
                    ))}
                </FormGroup>
                {error && <FormHelperText>{error}</FormHelperText>}
            </FormControl>
        );
    }

    if (inputType === "phone") {
        return (
            <TextField
                fullWidth
                label={label}
                type="tel"
                value={value || ""}
                onChange={(e) => onChange(fieldKey, filterPhoneInput(e.target.value))}
                onKeyPress={onKeyPressPhone}
                required={isRequired}
                error={Boolean(error)}
                helperText={error}
                autoComplete="off"
                InputProps={{
                    startAdornment: (
                        <CountryCodeSelector
                            value={phoneIsoCode}
                            onChange={(iso) => onPhoneIsoChange(fieldKey, iso)}
                            lang={lang}
                        />
                    ),
                }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 30 } }}
            />
        );
    }

    if (inputType === "country") {
        return (
            <CountryPicker
                label={label}
                value={value || ""}
                onChange={(iso) => onChange(fieldKey, iso)}
                required={isRequired}
                error={Boolean(error)}
                helperText={error}
                lang={lang}
            />
        );
    }

    // Passport-country / nationality / country-of-issue → CountryPicker
    const isPassportCountryField =
        fieldKeyLower.includes("passport_country") ||
        fieldKeyLower.includes("passportcountry") ||
        fieldKeyLower.includes("country_of_issue") ||
        fieldKeyLower.includes("countryofissue") ||
        fieldKeyLower.includes("nationality") ||
        (fieldLabelLower.includes("country") && fieldLabelLower.includes("passport")) ||
        fieldLabelLower.includes("nationality");

    if (isPassportCountryField) {
        return (
            <CountryPicker
                label={label}
                value={value || ""}
                onChange={(iso) => onChange(fieldKey, iso)}
                required={isRequired}
                error={Boolean(error)}
                helperText={error}
                lang={lang}
            />
        );
    }

    // Text-like fallback (text / number / email / date / time / passport number / etc.)
    let textType = "text";
    const validTypes = ["number", "email", "date", "time", "datetime-local"];
    if (validTypes.includes(inputType)) textType = inputType;

    // Passport number should stay as plain text (not email/date)
    if (fieldLabelLower.includes("passport") || fieldKeyLower.includes("passport")) {
        textType = "text";
    }
    if (fieldLabelLower.includes("time") && !fieldLabelLower.includes("date")) {
        textType = "time";
    }

    const isNumeric = textType === "number";
    const isDateLike = ["date", "time", "datetime-local"].includes(textType);

    return (
        <TextField
            fullWidth
            label={label}
            type={textType}
            value={value || ""}
            onChange={(e) => {
                let v = e.target.value;
                if (isNumeric) v = filterNumberInput(v);
                if (textType === "date" && v) {
                    const parts = v.split("-");
                    if (parts[0] && parts[0].length > 4) {
                        parts[0] = parts[0].slice(0, 4);
                        v = parts.join("-");
                    }
                }
                onChange(fieldKey, v);
            }}
            onKeyPress={isNumeric ? onKeyPressNumeric : undefined}
            required={isRequired}
            error={Boolean(error)}
            helperText={error}
            autoComplete="off"
            inputProps={textType === "date" ? { max: "9999-12-31" } : {}}
            InputLabelProps={isDateLike ? { shrink: true } : {}}
            sx={{
                "& .MuiOutlinedInput-root": { borderRadius: 30 },
                "& input[type='date']::-webkit-calendar-picker-indicator, & input[type='datetime-local']::-webkit-calendar-picker-indicator": {
                    display: "none",
                },
                "& input[type='date']::-webkit-date-and-time-value": { textAlign: "left" },
                "& input[type='time']::-webkit-calendar-picker-indicator": { display: "none" },
            }}
        />
    );
}
