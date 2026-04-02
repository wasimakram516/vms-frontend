"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  Divider,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  FormLabel,
  RadioGroup,
  Radio,
  FormGroup,
  CircularProgress,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import { getFields } from "@/services/registrationService";
import { getDepartments } from "@/services/departmentService";
import { getPublicActiveNdaTemplate } from "@/services/ndaTemplateService";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";
import PurposeOfVisitInput from "@/components/PurposeOfVisitInput";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import CountryPicker from "@/components/CountryPicker";
import RichTextEditor from "@/components/RichTextEditor";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import NdaTemplateContent from "@/components/NdaTemplateContent";
import { DEFAULT_ISO_CODE, getCountryCodeByIsoCode, DEFAULT_COUNTRY_CODE, COUNTRY_CODES } from "@/utils/countryCodes";
import { validateField, validateRequired } from "@/utils/validationUtils";

export default function DetailsPage() {
  const router = useRouter();
  const { visitorData, setVisitorData, flowState, setFlowState } = useVisitor();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [ndaOpen, setNdaOpen] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(flowState.ndaAccepted || false);
  const [ndaTemplate, setNdaTemplate] = useState(null);
  const [ndaLoading, setNdaLoading] = useState(true);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const fetchedFields = await getFields();
        const safeFields = Array.isArray(fetchedFields) ? fetchedFields : [];
        setFields(safeFields);
        
        // Initialize country codes for phone fields - for both new and returning visitors
        const phoneFields = safeFields.filter(field => (field.input_type || field.inputType || '').toLowerCase() === "phone");
        const countryIsoCodes = {};
        
        phoneFields.forEach(field => {
          const fieldKey = field.field_key || field.fieldKey;
          const phoneValue = visitorData.dynamicFields?.[fieldKey] || visitorData[fieldKey] || visitorData.phone;
          
          // First priority: use phoneIsoCode from returning visitor's last registration
          if (visitorData.phoneIsoCode) {
            countryIsoCodes[fieldKey] = visitorData.phoneIsoCode;
          }
          // Second priority: try to detect from phone value if it has country code
          else if (phoneValue && String(phoneValue).startsWith("+")) {
            const countryCode = COUNTRY_CODES.find(cc => String(phoneValue).startsWith(cc.code));
            if (countryCode) {
              countryIsoCodes[fieldKey] = countryCode.isoCode;
            } else {
              countryIsoCodes[fieldKey] = DEFAULT_ISO_CODE;
            }
          } else {
            countryIsoCodes[fieldKey] = DEFAULT_ISO_CODE;
          }
        });
        
        if (Object.keys(countryIsoCodes).length > 0) {
          setVisitorData(prev => ({
            ...prev,
            countryIsoCodes: { ...prev.countryIsoCodes, ...countryIsoCodes }
          }));
        }
      } catch (err) {
        console.error("Failed to fetch fields", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorData.phoneIsoCode]);

  useEffect(() => {
    getDepartments(true).then((res) => {
      if (Array.isArray(res)) setDepartments(res);
    });
  }, []);

  useEffect(() => {
    const fetchNdaTemplate = async () => {
      setNdaLoading(true);
      const template = await getPublicActiveNdaTemplate();
      setNdaTemplate(template?.error ? null : template || null);
      setNdaLoading(false);
    };

    fetchNdaTemplate();
  }, []);

  const getPhoneDisplayValue = (phone, isoCode) => {
    if (!phone) return "";
    // If phone starts with +, extract just the digits
    if (phone.startsWith("+")) {
      const country = getCountryCodeByIsoCode(isoCode);
      if (country && phone.startsWith(country.code)) {
        return phone.substring(country.code.length);
      }
      // If it starts with + but we can't match the country code, remove the +
      return phone.substring(1);
    }
    return phone;
  };

  const handleCountryCodeChange = (key, isoCode) => {
    setVisitorData((prev) => ({
      ...prev,
      countryIsoCodes: { ...(prev.countryIsoCodes || {}), [key]: isoCode },
    }));
  };

  // ── Dependent field visibility ─────────────────────────────────────────────
  // Build a set of all child field IDs that appear in any dependentsJson
  const allChildFieldIds = useMemo(() => {
    const ids = new Set();
    fields.forEach((f) => {
      const deps = f.dependents_json || f.dependentsJson;
      if (deps) {
        Object.values(deps).forEach((childIds) => childIds.forEach((id) => ids.add(id)));
      }
    });
    return ids;
  }, [fields]);

  // Compute which field IDs are currently visible — BFS supports arbitrary nesting depth
  const visibleFieldIds = useMemo(() => {
    const visible = new Set();
    const fieldById = Object.fromEntries(fields.map((f) => [f.id, f]));
    const queue = [];

    // Seed with top-level fields (not a child of any parent)
    fields.forEach((f) => {
      if (!allChildFieldIds.has(f.id)) {
        visible.add(f.id);
        queue.push(f);
      }
    });

    // BFS: for each visible field, resolve its triggered children and enqueue them
    while (queue.length > 0) {
      const current = queue.shift();
      const deps = current.dependents_json || current.dependentsJson;
      if (!deps) continue;
      const currentValue = visitorData.dynamicFields?.[current.field_key || current.fieldKey];
      if (currentValue && deps[currentValue]) {
        deps[currentValue].forEach((childId) => {
          if (!visible.has(childId)) {
            visible.add(childId);
            const child = fieldById[childId];
            if (child) queue.push(child);
          }
        });
      }
    }

    return visible;
  }, [fields, allChildFieldIds, visitorData.dynamicFields]);

  // Recursively clear values for all fields that are no longer visible under a given parent
  const clearHiddenChildren = (parentField, newValue, updatedDynamicFields) => {
    const deps = parentField?.dependents_json || parentField?.dependentsJson;
    if (!deps) return;
    Object.entries(deps).forEach(([triggerVal, childIds]) => {
      if (triggerVal !== newValue) {
        childIds.forEach((childId) => {
          const childField = fields.find((f) => f.id === childId);
          if (childField) {
            const childKey = childField.field_key || childField.fieldKey;
            const currentChildValue = updatedDynamicFields[childKey];
            delete updatedDynamicFields[childKey];
            // Recurse: also clear grandchildren that were triggered by this child
            clearHiddenChildren(childField, currentChildValue, updatedDynamicFields);
          }
        });
      }
    });
  };

  // Clear hidden dependent field values when they become invisible
  const handleFieldChange = (key, value) => {
    setVisitorData((prev) => {
      const updated = { ...prev.dynamicFields, [key]: value };
      const field = fields.find((f) => (f.field_key || f.fieldKey) === key);
      clearHiddenChildren(field, value, updated);
      return { ...prev, dynamicFields: updated };
    });
    if (errors[key]) {
      setErrors((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors = {};

    fields.filter((f) => visibleFieldIds.has(f.id)).forEach((f) => {
      const fieldKey = f.field_key || f.fieldKey;
      const val = visitorData.dynamicFields[fieldKey];
      const isoCode = visitorData.countryIsoCodes?.[fieldKey];

      const error = validateField(
        {
          ...f,
          inputName: fieldKey,
          inputType: f.input_type || f.inputType || "text",
          required: f.is_required || f.isRequired,
          label: f.label,
          values: f.options_json || f.optionsJson,
        },
        val,
        { isoCode }
      );

      if (error) {
        newErrors[fieldKey] = error;
      }
    });

    if (!visitorData.departmentId) {
      newErrors.departmentId = "Department is required";
    }

    const purposeError = validateRequired(visitorData.purposeOfVisit, "Purpose of Visit");
    if (purposeError) {
      newErrors.purposeOfVisit = purposeError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate() || !ndaAccepted) return;

    const processedFields = { ...visitorData.dynamicFields };
    let phoneIsoCode = null;
    
    fields.forEach((f) => {
      const fieldKey = f.field_key || f.fieldKey;
      const inputType = (f.input_type || f.inputType || "text").toLowerCase();
      const val = processedFields[fieldKey];

      if (inputType === "phone" && val) {
        const isoCode = visitorData.countryIsoCodes?.[fieldKey] || DEFAULT_ISO_CODE;
        const country = getCountryCodeByIsoCode(isoCode);
        const countryCode = country?.code || DEFAULT_COUNTRY_CODE;
        
        // Store the ISO code for the registration payload
        phoneIsoCode = isoCode;
        
        // Store phone without country code prefix in fieldValues
        if (val.startsWith("+")) {
          if (val.startsWith(countryCode)) {
            processedFields[fieldKey] = val.substring(countryCode.length);
          } else {
            processedFields[fieldKey] = val.replace(/^\+/, "");
          }
        } else {
          processedFields[fieldKey] = val;
        }
      }
    });

    setVisitorData((prev) => ({
      ...prev,
      dynamicFields: processedFields,
      phoneIsoCode: phoneIsoCode || DEFAULT_ISO_CODE,
    }));

    setFlowState((prev) => ({ ...prev, ndaAccepted: true, currentStep: "booking" }));
    router.push("/register/booking");
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <VisitorLayout 
      title="Visitor Registration" 
      subtitle="Please provide your information to ensure a smooth check-in process at Sinan."
      maxWidth={650}
    >
      <form autoComplete="off">
        <Stack spacing={3}>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h5" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive" }}>
              Tell us about yourself
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              Fill in the details below to complete your registration.
            </Typography>
          </Box>

          <Divider />

          <Stack spacing={3}>
            {fields.length === 0 ? (
              <NoDataAvailable
                title="Registration unavailable"
                description="Registration is currently unavailable. Please contact the administrator."
                compact
                minHeight={220}
              />
            ) : (
              fields.filter((f) => visibleFieldIds.has(f.id)).map((f) => {
                const fieldKey = f.field_key || f.fieldKey;
                const isRequired = f.is_required || f.isRequired;
                const inputType = (f.input_type || f.inputType || "text").toLowerCase();
                const options = f.options_json || f.optionsJson || [];
                let val = visitorData.dynamicFields[fieldKey] !== undefined ? visitorData.dynamicFields[fieldKey] : (inputType === "checkbox" ? [] : "");
                
                if (inputType === "phone" && !val && visitorData.phone) {
                  val = visitorData.phone;
                  visitorData.dynamicFields[fieldKey] = visitorData.phone;
                }
                
                const error = errors[fieldKey];

                if (inputType === "select") {
                  return (
                    <FormControl key={f.id || fieldKey} fullWidth error={Boolean(error)} required={isRequired}>
                      <InputLabel>{f.label}</InputLabel>
                      <Select
                        value={val}
                        label={f.label}
                        onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                        sx={{ borderRadius: 30 }}
                      >
                        {options.map((opt) => (
                          <MenuItem key={opt} value={opt}>
                            {opt}
                          </MenuItem>
                        ))}
                      </Select>
                      {error && <FormHelperText>{error}</FormHelperText>}
                    </FormControl>
                  );
                }

                if (inputType === "radio") {
                  return (
                    <FormControl key={f.id || fieldKey} error={Boolean(error)} required={isRequired}>
                      <FormLabel>{f.label}</FormLabel>
                      <RadioGroup
                        row
                        value={val}
                        onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                      >
                        {options.map((opt) => (
                          <FormControlLabel key={opt} value={opt} control={<Radio />} label={opt} />
                        ))}
                      </RadioGroup>
                      {error && <FormHelperText>{error}</FormHelperText>}
                    </FormControl>
                  );
                }

                if (inputType === "checkbox") {
                  const checkVals = Array.isArray(val) ? val : (val ? [val] : []);
                  const handleCheckChange = (opt, checked) => {
                    if (checked) {
                      handleFieldChange(fieldKey, [...checkVals, opt]);
                    } else {
                      handleFieldChange(fieldKey, checkVals.filter((v) => v !== opt));
                    }
                  };
                  return (
                    <FormControl key={f.id || fieldKey} error={Boolean(error)} required={isRequired}>
                      <FormLabel>{f.label}</FormLabel>
                      <FormGroup row>
                        {options.map((opt) => (
                          <FormControlLabel
                            key={opt}
                            control={
                              <Checkbox
                                checked={checkVals.includes(opt)}
                                onChange={(e) => handleCheckChange(opt, e.target.checked)}
                              />
                            }
                            label={opt}
                          />
                        ))}
                      </FormGroup>
                      {error && <FormHelperText>{error}</FormHelperText>}
                    </FormControl>
                  );
                }

                let textType = "text";
                const validTypes = ["number", "email", "date", "time", "datetime-local", "password", "url"];
                if (validTypes.includes(inputType)) {
                  textType = inputType;
                }

                const fieldLabel = (f.label || "").toLowerCase();
                if (fieldLabel.includes("time") && !fieldLabel.includes("date")) {
                  textType = "time";
                }

                if (inputType === "phone") {
                  const isoCode = visitorData.countryIsoCodes?.[fieldKey] || DEFAULT_ISO_CODE;
                  return (
                    <TextField
                      key={f.id || fieldKey}
                      fullWidth
                      label={f.label}
                      type="tel"
                      value={getPhoneDisplayValue(val, isoCode)}
                      onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                      required={isRequired}
                      error={Boolean(error)}
                      helperText={error}
                      size="medium"
                      placeholder={f.label}
                      autoComplete="off"
                      InputProps={{
                        startAdornment: (
                          <CountryCodeSelector
                            value={isoCode}
                            onChange={(iso) => handleCountryCodeChange(fieldKey, iso)}
                          />
                        ),
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 30,
                        },
                      }}
                    />
                  );
                }

                if (inputType === "country") {
                  return (
                    <CountryPicker
                      key={f.id || fieldKey}
                      label={f.label}
                      value={val || ""}
                      onChange={(iso) => handleFieldChange(fieldKey, iso)}
                      required={isRequired}
                      error={Boolean(error)}
                      helperText={error}
                    />
                  );
                }

                if (inputType === "textarea") {
                  return (
                    <Box key={f.id || fieldKey}>
                      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: error ? "error.main" : "text.secondary" }}>
                        {f.label} {isRequired && "*"}
                      </Typography>
                      <RichTextEditor
                        value={val}
                        onChange={(html) => handleFieldChange(fieldKey, html)}
                        placeholder={f.label}
                      />
                      {error && <FormHelperText error>{error}</FormHelperText>}
                    </Box>
                  );
                }

                if (inputType === "file") {
                  return (
                    <Box key={f.id || fieldKey}>
                      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: error ? "error.main" : "text.secondary" }}>
                        {f.label} {isRequired && "*"}
                      </Typography>
                      <TextField
                        fullWidth
                        type="file"
                        onChange={(e) => handleFieldChange(fieldKey, e.target.files[0])}
                        error={Boolean(error)}
                        helperText={error}
                        size="medium"
                        inputProps={{ accept: "*/*" }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 30,
                          },
                        }}
                      />
                    </Box>
                  );
                }

                return (
                  <TextField
                    key={f.id || fieldKey}
                    fullWidth
                    label={f.label}
                    type={textType}
                    value={val}
                    onChange={(e) => {
                      let value = e.target.value;
                      if (textType === "date" && value) {
                        const parts = value.split("-");
                        if (parts[0] && parts[0].length > 4) {
                          parts[0] = parts[0].slice(0, 4);
                          value = parts.join("-");
                        }
                      }
                      handleFieldChange(fieldKey, value);
                    }}
                    required={isRequired}
                    error={Boolean(error)}
                    helperText={error}
                    size="medium"
                    placeholder={f.label}
                    autoComplete="off"
                    inputProps={textType === "date" ? { max: "9999-12-31" } : {}}
                    InputLabelProps={["date", "time", "datetime-local"].includes(textType) ? { shrink: true } : {}}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 30,
                      },
                      "& input[type='date']::-webkit-calendar-picker-indicator, & input[type='datetime-local']::-webkit-calendar-picker-indicator": {
                        display: "none",
                      },
                      "& input[type='date']::-webkit-date-and-time-value": {
                        textAlign: "left",
                      },
                      "& input[type='time']::-webkit-calendar-picker-indicator": {
                        display: "none",
                      },
                    }}
                  />
                );
              })
            )}
          </Stack>

          <Divider />

          <FormControl
            fullWidth
            required
            error={Boolean(errors.departmentId)}
          >
            <InputLabel>Department</InputLabel>
            <Select
              value={visitorData.departmentId || ""}
              label="Department"
              onChange={(e) => {
                setVisitorData((prev) => ({ ...prev, departmentId: e.target.value }));
                if (errors.departmentId) {
                  setErrors((p) => { const n = { ...p }; delete n.departmentId; return n; });
                }
              }}
              sx={{ borderRadius: 30 }}
            >
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.id}>
                  {dept.name}
                </MenuItem>
              ))}
            </Select>
            {errors.departmentId && <FormHelperText>{errors.departmentId}</FormHelperText>}
          </FormControl>

          <PurposeOfVisitInput
            value={visitorData.purposeOfVisit || ""}
            onChange={(val) => {
              setVisitorData((prev) => ({ ...prev, purposeOfVisit: val }));
              if (errors.purposeOfVisit) {
                setErrors((p) => { const n = { ...p }; delete n.purposeOfVisit; return n; });
              }
            }}
            required
            error={Boolean(errors.purposeOfVisit)}
            helperText={errors.purposeOfVisit}
            rounded
          />

          <Divider />

          <Stack spacing={0.75}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={ndaAccepted}
                  onChange={() => {
                    if (!ndaAccepted) setNdaOpen(true);
                    else setNdaAccepted(false);
                  }}
                  color="primary"
                />
              }
              label={
                <Typography component="span" variant="body2" fontWeight={600}>
                  I have read and agree to the Non-Disclosure Agreement
                </Typography>
              }
            />
            <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>
              Please review our NDA before scheduling your visit. The Schedule button will be enabled once you agree.
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<ICONS.cancel />}
              onClick={() => router.push("/")}
              sx={{ py: 1.5, borderRadius: 30 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              fullWidth
              disabled={!ndaAccepted || fields.length === 0}
              startIcon={<ICONS.event />}
              onClick={() => handleNext()}
              sx={{ py: 1.5, borderRadius: 30 }}
            >
              Schedule
            </Button>
          </Stack>
        </Stack>
      </form>

      {/* NDA Modal */}
      <Dialog open={ndaOpen} onClose={() => setNdaOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={800} component="span" sx={{ fontFamily: "'Comfortaa', cursive" }}>
            {ndaTemplate?.name || "Non-Disclosure Agreement"}
          </Typography>
          <IconButton onClick={() => setNdaOpen(false)}>
            <ICONS.close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: "rgba(0,0,0,0.05)" }}>
          {ndaLoading ? (
            <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Loading NDA...
              </Typography>
            </Stack>
          ) : (
            <NdaTemplateContent template={ndaTemplate} />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setNdaOpen(false)}
            sx={{ borderRadius: 30 }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<ICONS.check />}
            onClick={() => { setNdaAccepted(true); setNdaOpen(false); }}
            sx={{ borderRadius: 30 }}
          >
            I Agree
          </Button>
        </DialogActions>
      </Dialog>
    </VisitorLayout>
  );
}
