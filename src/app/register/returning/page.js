"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  CircularProgress,
  Divider,
  alpha,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import {
  sendOtpSilently,
  getFields,
  verifyReturningById,
  checkNdaValidity,
} from "@/services/registrationService";
import { useColorMode } from "@/contexts/ThemeContext";
import useI18nLayout from "@/hooks/useI18nLayout";
import registrationTranslations from "@/locales/registration";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";
import DynamicCustomField from "@/components/DynamicCustomField";
import { validateEmail } from "@/utils/validationUtils";
import getStartIconSpacing from "@/utils/getStartIconSpacing";
import {
  ID_ALIASES,
  ID_TYPE_ALIASES,
  PHONE_ALIASES,
  FULL_NAME_ALIASES,
  findFieldByAliases,
  computeVisibleFieldIds,
  collectSubtreeIds,
  clearHiddenChildren,
  getChildFieldIds,
  getArLabel,
} from "@/utils/customFieldUtils";
import { applyReturningVerification } from "@/utils/returningFlow";
import { filterPhoneInput } from "@/utils/phoneUtils";
import { validatePhone } from "@/utils/validationUtils";
import { DEFAULT_ISO_CODE } from "@/utils/countryCodes";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import { translateBatch } from "@/services/translationService";

export default function ReturningVisitorPage() {
  const router = useRouter();
  const { visitorData, setVisitorData, setFlowState } = useVisitor();
  const { mode } = useColorMode();
  const { t, isArabic: isRtl } = useI18nLayout(registrationTranslations);
  const dir = isRtl ? "rtl" : "ltr";
  const isDark = mode === "dark";
  const lang = isRtl ? "ar" : "en";

  // ── Email tab state ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState("email");
  const [email, setEmail] = useState(
    visitorData.identity?.includes("@") ? visitorData.identity : ""
  );
  const [emailError, setEmailError] = useState("");
  const [otpRequestError, setOtpRequestError] = useState("");

  // ── ID tab state ─────────────────────────────────────────────────────────────
  const [allFields, setAllFields] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState(false);
  const [fieldsLoadedOnce, setFieldsLoadedOnce] = useState(false);
  // { fieldKey: value } map for all ID-subtree fields AND the phone field
  const [idFieldValues, setIdFieldValues] = useState({});
  const [idErrors, setIdErrors] = useState({});
  // Standalone phone state — only used when no custom phone field is configured
  const [standalonePhone, setStandalonePhone] = useState("");
  const [standalonePhoneIso, setStandalonePhoneIso] = useState(DEFAULT_ISO_CODE);
  const [standalonePhoneError, setStandalonePhoneError] = useState("");
  // ISO codes per fieldKey for custom phone-type fields, so validatePhone can run with the right country
  const [phoneIsoCodes, setPhoneIsoCodes] = useState({});
  const [idLoading, setIdLoading] = useState(false);
  // Translated labels and option values for Arabic (keyed by fieldKey)
  const [translatedLabels, setTranslatedLabels] = useState({});
  const [translatedOptions, setTranslatedOptions] = useState({});

  // Fetch form fields when the ID tab is first selected (or on retry)
  const loadFields = () => {
    setFieldsLoading(true);
    setFieldsError(false);
    getFields()
      .then((res) => {
        if (!res?.error && Array.isArray(res)) {
          setAllFields(res);
          setFieldsLoadedOnce(true);
        } else {
          setFieldsError(true);
          setFieldsLoadedOnce(true);
        }
      })
      .catch(() => setFieldsError(true))
      .finally(() => setFieldsLoading(false));
  };

  useEffect(() => {
    if (method !== "id") return;
    if (allFields.length > 0) return; // already loaded
    loadFields();
  }, [method]); // eslint-disable-line react-hooks/exhaustive-deps

  // Translate field labels and option values for Arabic.
  // Known labels come from the static map instantly; unknowns are batch-translated via API.
  useEffect(() => {
    if (!allFields.length || !isRtl) return;
    let cancelled = false;

    // ── Labels ──────────────────────────────────────────────────────────────
    const labelMapImmediate = {};
    const labelMisses = []; // { key, label } not found in static map

    allFields.forEach((f) => {
      const key = f.fieldKey || f.field_key;
      const ar = getArLabel(f.label);
      if (ar) {
        labelMapImmediate[key] = ar;
      } else {
        labelMisses.push({ key, label: f.label || "" });
      }
    });
    setTranslatedLabels((prev) => ({ ...prev, ...labelMapImmediate }));

    if (labelMisses.length > 0) {
      translateBatch(labelMisses.map((m) => m.label), "ar")
        .then((results) => {
          if (cancelled) return;
          setTranslatedLabels((prev) => {
            const next = { ...prev };
            labelMisses.forEach(({ key, label }, i) => { next[key] = results[i] || label; });
            return next;
          });
        })
        .catch(() => {});
    }

    // ── Options ─────────────────────────────────────────────────────────────
    const optionFields = allFields.filter((f) => {
      const type = (f.inputType || f.input_type || "").toLowerCase();
      return ["select", "radio", "checkbox"].includes(type);
    });
    if (!optionFields.length) return () => { cancelled = true; };

    const optMapImmediate = {};
    const optMisses = new Set(); // option values not in static map

    optionFields.forEach((f) => {
      const key = f.fieldKey || f.field_key;
      optMapImmediate[key] = {};
      (f.optionsJson || f.options_json || []).forEach((o) => {
        const ar = getArLabel(o);
        if (ar) {
          optMapImmediate[key][o] = ar;
        } else {
          optMisses.add(o);
        }
      });
    });
    setTranslatedOptions((prev) => ({ ...prev, ...optMapImmediate }));

    if (optMisses.size > 0) {
      const uniqueOpts = [...optMisses];
      translateBatch(uniqueOpts, "ar")
        .then((results) => {
          if (cancelled) return;
          const globalMap = Object.fromEntries(uniqueOpts.map((o, i) => [o, results[i] || o]));
          setTranslatedOptions((prev) => {
            const next = { ...prev };
            optionFields.forEach((f) => {
              const key = f.fieldKey || f.field_key;
              if (!next[key]) next[key] = {};
              (f.optionsJson || f.options_json || []).forEach((o) => {
                if (!next[key][o] && globalMap[o]) next[key][o] = globalMap[o];
              });
            });
            return next;
          });
        })
        .catch(() => {});
    }

    return () => { cancelled = true; };
  }, [allFields, isRtl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Compute ID subtree + phone field + full name field ──────────────────────
  const { idSubtreeFields, phoneField, fullNameField } = useMemo(() => {
    if (!allFields.length) return { idSubtreeFields: [], phoneField: null, fullNameField: null };

    const idTypeParent = findFieldByAliases(allFields, ID_TYPE_ALIASES);
    const phone = findFieldByAliases(allFields, PHONE_ALIASES);
    const fullName = findFieldByAliases(allFields, FULL_NAME_ALIASES);

    let subtreeIds;
    if (idTypeParent) {
      subtreeIds = collectSubtreeIds(idTypeParent, allFields);
    } else {
      const standalone = findFieldByAliases(allFields, ID_ALIASES);
      subtreeIds = standalone ? new Set([standalone.id]) : new Set();
    }

    const visibleIds = computeVisibleFieldIds(allFields, idFieldValues);
    const subtree = allFields.filter(
      (f) => subtreeIds.has(f.id) && visibleIds.has(f.id)
    );

    return { idSubtreeFields: subtree, phoneField: phone, fullNameField: fullName };
  }, [allFields, idFieldValues]);

  // Forced-required IDs from parent trigger settings
  const forcedRequiredIds = useMemo(() => {
    const forced = new Set();
    const visibleIds = computeVisibleFieldIds(allFields, idFieldValues);
    allFields.filter((f) => visibleIds.has(f.id)).forEach((parent) => {
      const deps = parent.dependentsJson || parent.dependents_json;
      if (!deps) return;
      const val = idFieldValues[parent.fieldKey || parent.field_key];
      if (val && deps[val]?.areAllRequired) {
        getChildFieldIds(deps[val]).forEach((id) => forced.add(id));
      }
    });
    return forced;
  }, [allFields, idFieldValues]);

  // ── Email tab handlers ───────────────────────────────────────────────────────
  const validateEmailField = (value) => validateEmail(value, "Email") || "";

  const handleEmailNext = async () => {
    const err = validateEmailField(email);
    if (err) { setEmailError(err); return; }
    const finalIdentity = email.trim().toLowerCase();
    setLoading(true);
    setOtpRequestError("");
    try {
      const res = await sendOtpSilently(finalIdentity);
      if (!res.error) {
        setVisitorData((p) => ({ ...p, identity: finalIdentity, email: finalIdentity }));
        setFlowState((prev) => ({ ...prev, isReturning: true, currentStep: "otp" }));
        router.push("/register/otp");
      } else {
        setOtpRequestError(res.message || t.returningOtpError);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── ID tab handlers ──────────────────────────────────────────────────────────
  const handleIdFieldChange = (key, value) => {
    setIdFieldValues((prev) => {
      const updated = { ...prev, [key]: value };
      const field = allFields.find((f) => (f.fieldKey || f.field_key) === key);
      clearHiddenChildren(field, value, updated, allFields);
      return updated;
    });
    if (idErrors[key]) {
      setIdErrors((p) => { const n = { ...p }; delete n[key]; return n; });
    }
  };

  // Track ISO codes for custom phone-type fields so validatePhone can use the right country
  const handlePhoneIsoChange = (key, iso) => {
    setPhoneIsoCodes((prev) => ({ ...prev, [key]: iso }));
  };

  const validateIdForm = () => {
    const errs = {};

    idSubtreeFields.forEach((f) => {
      const key = f.fieldKey || f.field_key;
      const inputType = (f.inputType || f.input_type || "text").toLowerCase();
      const isRequired = f.isRequired || f.is_required || forcedRequiredIds.has(f.id);
      const val = idFieldValues[key];

      if (isRequired && !val) {
        errs[key] = t.fieldRequired.replace("{{field}}", f.label);
      } else if (inputType === "phone" && val) {
        const iso = phoneIsoCodes[key] || DEFAULT_ISO_CODE;
        const phoneErr = validatePhone(val, iso);
        if (phoneErr) errs[key] = phoneErr;
      }
    });

    // Phone field validation
    if (phoneField) {
      const phoneKey = phoneField.fieldKey || phoneField.field_key;
      const phoneVal = idFieldValues[phoneKey];
      if (!phoneVal) {
        errs[phoneKey] = t.fieldRequired.replace("{{field}}", phoneField.label);
      } else {
        const iso = phoneIsoCodes[phoneKey] || DEFAULT_ISO_CODE;
        const phoneErr = validatePhone(phoneVal, iso);
        if (phoneErr) errs[phoneKey] = phoneErr;
      }
    } else {
      if (!standalonePhone.trim()) {
        errs.__standalonePhone = t.fieldRequired.replace("{{field}}", t.returningIdPhoneLabel);
      } else {
        const phoneErr = validatePhone(standalonePhone, standalonePhoneIso);
        if (phoneErr) errs.__standalonePhone = phoneErr;
      }
    }

    return errs;
  };

  const resolvePhone = () => {
    if (phoneField) {
      const phoneKey = phoneField.fieldKey || phoneField.field_key;
      return String(idFieldValues[phoneKey] || "").trim();
    }
    return standalonePhone.trim();
  };

  const handleIdSubmit = async () => {
    const errs = validateIdForm();
    const { __standalonePhone, ...fieldErrs } = errs;
    if (Object.keys(errs).length > 0) {
      setIdErrors(fieldErrs);
      if (__standalonePhone) setStandalonePhoneError(__standalonePhone);
      return;
    }

    setIdLoading(true);
    try {
      const phone = resolvePhone();
      const res = await verifyReturningById(idFieldValues, phone);
      if (!res.error && res.success) {
        await applyReturningVerification(res, {
          setFlowState,
          setVisitorData,
          router,
          checkNdaValidity,
        });
      }
      // On error: withApiHandler already showed the global snackbar (inactive / not found)
    } finally {
      setIdLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <VisitorLayout justifyContent="center" mobileSubheading={t.returningHeading}>
      <Stack spacing={3}>
        <Box sx={{ textAlign: "center", mb: 2, display: { xs: "none", md: "block" } }}>
          <Typography variant="h5" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive" }}>
            {t.returningHeading}
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            {t.returningSubtitle}
          </Typography>
        </Box>

        <Divider />

        <Tabs
          value={method}
          onChange={(_, value) => setMethod(value)}
          variant="fullWidth"
          sx={{
            minHeight: 46,
            bgcolor: (theme) => alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
            borderRadius: 999,
            p: 0.5,
            "& .MuiTabs-indicator": { display: "none" },
          }}
        >
          <Tab
            value="email"
            icon={<ICONS.email fontSize="small" />}
            iconPosition="start"
            label={t.returningEmailTab}
            sx={{
              minHeight: 38,
              borderRadius: 999,
              fontWeight: 800,
              textTransform: "none",
              "& .MuiTab-iconWrapper": {
                marginRight: isRtl ? 0 : "8px",
                marginLeft: isRtl ? "8px" : 0,
              },
              "&.Mui-selected": {
                bgcolor: "background.paper",
                color: "text.primary",
                boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
              },
            }}
          />
          <Tab
            value="id"
            icon={<ICONS.badge fontSize="small" />}
            iconPosition="start"
            label={t.returningIdTab}
            sx={{
              minHeight: 38,
              borderRadius: 999,
              fontWeight: 800,
              textTransform: "none",
              "& .MuiTab-iconWrapper": {
                marginRight: isRtl ? 0 : "8px",
                marginLeft: isRtl ? "8px" : 0,
              },
              "&.Mui-selected": {
                bgcolor: "background.paper",
                color: "text.primary",
                boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
              },
            }}
          />
        </Tabs>

        {method === "email" ? (
          <Stack spacing={2.5}>
            {otpRequestError && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {otpRequestError}
              </Alert>
            )}
            <TextField
              fullWidth
              autoFocus
              label={t.returningEmailLabel}
              type="email"
              placeholder="name@example.com"
              value={email}
              error={Boolean(emailError)}
              helperText={emailError}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
              }}
              onBlur={() => setEmailError(validateEmailField(email))}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
              onKeyDown={(e) => e.key === "Enter" && handleEmailNext()}
            />
            <Button
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              onClick={handleEmailNext}
              startIcon={loading ? <CircularProgress size={24} color="inherit" /> : <ICONS.email />}
              sx={{ py: 1.8, borderRadius: 30, fontWeight: 700, ...getStartIconSpacing(dir) }}
            >
              {loading ? t.returningSendingOtp : t.returningSendOtp}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            {fieldsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : fieldsError ? (
              <Stack spacing={1.5} alignItems="center">
                <Alert severity="error" sx={{ borderRadius: 2, width: "100%" }}>
                  {t.returningIdFieldsError}
                </Alert>
                <Button variant="outlined" size="small" onClick={loadFields}>
                  {t.retry || "Retry"}
                </Button>
              </Stack>
            ) : idSubtreeFields.length === 0 ? (
              fieldsLoadedOnce ? (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  {t.returningIdNoFields}
                </Alert>
              ) : (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress size={32} />
                </Box>
              )
            ) : (
              <>
                {/* Full Name — first field, shown for display, not required for verification */}
                {fullNameField && (() => {
                  const key = fullNameField.fieldKey || fullNameField.field_key;
                  return (
                    <DynamicCustomField
                      key={fullNameField.id || key}
                      field={fullNameField}
                      value={idFieldValues[key] !== undefined ? idFieldValues[key] : ""}
                      error={idErrors[key] || ""}
                      isRequired={false}
                      onChange={handleIdFieldChange}
                      phoneIsoCode={phoneIsoCodes[key] || DEFAULT_ISO_CODE}
                      onPhoneIsoChange={handlePhoneIsoChange}
                      lang={lang}
                      translatedLabel={isRtl ? (translatedLabels[key] || getArLabel(fullNameField.label) || "") : ""}
                      translatedOptions={isRtl ? (translatedOptions[key] || {}) : {}}
                    />
                  );
                })()}

                {/* ID type selector + its dependents */}
                {idSubtreeFields.map((f) => {
                  const key = f.fieldKey || f.field_key;
                  const isRequired = f.isRequired || f.is_required || forcedRequiredIds.has(f.id);
                  return (
                    <DynamicCustomField
                      key={f.id || key}
                      field={f}
                      value={idFieldValues[key] !== undefined ? idFieldValues[key] : ""}
                      error={idErrors[key] || ""}
                      isRequired={isRequired}
                      onChange={handleIdFieldChange}
                      phoneIsoCode={phoneIsoCodes[key] || DEFAULT_ISO_CODE}
                      onPhoneIsoChange={handlePhoneIsoChange}
                      lang={lang}
                      translatedLabel={isRtl ? (translatedLabels[key] || "") : ""}
                      translatedOptions={isRtl ? (translatedOptions[key] || {}) : {}}
                    />
                  );
                })}

                {/* Phone — from custom fields if configured, else a standalone input */}
                {phoneField ? (
                  (() => {
                    const key = phoneField.fieldKey || phoneField.field_key;
                    return (
                      <DynamicCustomField
                        key={phoneField.id || key}
                        field={phoneField}
                        value={idFieldValues[key] !== undefined ? idFieldValues[key] : ""}
                        error={idErrors[key] || ""}
                        isRequired
                        onChange={handleIdFieldChange}
                        phoneIsoCode={phoneIsoCodes[key] || DEFAULT_ISO_CODE}
                        onPhoneIsoChange={handlePhoneIsoChange}
                        lang={lang}
                        translatedLabel={translatedLabels[key] || ""}
                        translatedOptions={translatedOptions[key] || {}}
                      />
                    );
                  })()
                ) : (
                  <TextField
                    fullWidth
                    label={t.returningIdPhoneLabel}
                    type="tel"
                    value={standalonePhone}
                    error={Boolean(standalonePhoneError)}
                    helperText={standalonePhoneError}
                    onChange={(e) => {
                      setStandalonePhone(filterPhoneInput(e.target.value));
                      if (standalonePhoneError) setStandalonePhoneError("");
                    }}
                    InputProps={{
                      startAdornment: (
                        <CountryCodeSelector
                          value={standalonePhoneIso}
                          onChange={(iso) => setStandalonePhoneIso(iso)}
                          lang={lang}
                        />
                      ),
                    }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 30 } }}
                  />
                )}

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={idLoading}
                  onClick={handleIdSubmit}
                  startIcon={idLoading ? <CircularProgress size={24} color="inherit" /> : <ICONS.badge />}
                  sx={{ py: 1.8, borderRadius: 30, fontWeight: 700, ...getStartIconSpacing(dir) }}
                >
                  {idLoading ? t.returningIdVerifying : t.returningIdSubmit}
                </Button>
              </>
            )}
          </Stack>
        )}

        <Button
          variant="text"
          fullWidth
          startIcon={<ICONS.back />}
          onClick={() => router.push("/")}
          sx={{ color: "text.disabled", textTransform: "none", ...getStartIconSpacing(dir) }}
        >
          {t.back}
        </Button>
      </Stack>
    </VisitorLayout>
  );
}
