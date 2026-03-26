"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Divider,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
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
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import { getFields } from "@/services/registrationService";
import { motion } from "framer-motion";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import RichTextEditor from "@/components/RichTextEditor";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import { DEFAULT_ISO_CODE, getCountryCodeByIsoCode, DEFAULT_COUNTRY_CODE, COUNTRY_CODES } from "@/utils/countryCodes";
import { validatePhoneNumberByCountry } from "@/utils/phoneValidation";

const transition = { duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] };

export default function DetailsPage() {
  const router = useRouter();
  const { visitorData, setVisitorData, flowState, setFlowState } = useVisitor();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [ndaOpen, setNdaOpen] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(flowState.ndaAccepted || false);
  const [purposeInput, setPurposeInput] = useState(visitorData.purposeOfVisit || "");

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const f = await getFields();
        setFields(f);
        
        // Initialize country codes for phone fields from returning visitor data
        if (visitorData.dynamicFields && Object.keys(visitorData.dynamicFields).length > 0) {
          const phoneFields = f.filter(field => (field.input_type || field.inputType) === "phone");
          const countryIsoCodes = {};
          
          phoneFields.forEach(field => {
            const fieldKey = field.field_key || field.fieldKey;
            const phoneValue = visitorData.dynamicFields[fieldKey];
            
            // If phone has country code, try to detect the country
            if (phoneValue && phoneValue.startsWith("+")) {
              // Try to find matching country code
              const countryCode = COUNTRY_CODES.find(cc => phoneValue.startsWith(cc.code));
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
        }
      } catch (err) {
        console.error("Failed to fetch fields", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFields();
  }, []);

  useEffect(() => {
    setPurposeInput(visitorData.purposeOfVisit || "");
  }, [visitorData.purposeOfVisit]);

  const handleFieldChange = (key, value) => {
    setVisitorData((prev) => ({
      ...prev,
      dynamicFields: { ...prev.dynamicFields, [key]: value },
    }));
    if (errors[key]) {
      setErrors((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };

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

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    fields.forEach((f) => {
      const fieldKey = f.field_key || f.fieldKey;
      const isRequired = f.is_required || f.isRequired;
      const inputType = f.input_type || f.inputType || "text";
      const val = visitorData.dynamicFields[fieldKey];

      if (isRequired && (!val || (Array.isArray(val) && val.length === 0))) {
        newErrors[fieldKey] = `${f.label} is required`;
      } else if (val && inputType === "email" && !emailRegex.test(val)) {
        newErrors[fieldKey] = `Please enter a valid email address`;
      } else if (val && inputType === "phone") {
        const isoCode = visitorData.countryIsoCodes?.[fieldKey] || DEFAULT_ISO_CODE;
        const phoneValidation = validatePhoneNumberByCountry(val, isoCode);
        if (!phoneValidation.valid) {
          newErrors[fieldKey] = phoneValidation.error || "Invalid phone number";
        }
      }
    });

    // Validate purpose of visit
    if (!purposeInput?.trim()) {
      newErrors.purposeOfVisit = "Purpose of visit is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate() || !ndaAccepted) return;

    const trimmedPurpose = purposeInput.trim();

    const processedFields = { ...visitorData.dynamicFields };
    fields.forEach((f) => {
      const fieldKey = f.field_key || f.fieldKey;
      const inputType = f.input_type || f.inputType || "text";
      const val = processedFields[fieldKey];

      if (inputType === "phone" && val) {
        const isoCode = visitorData.countryIsoCodes?.[fieldKey] || DEFAULT_ISO_CODE;
        const country = getCountryCodeByIsoCode(isoCode);
        const countryCode = country?.code || DEFAULT_COUNTRY_CODE;
        if (!val.startsWith("+")) {
          processedFields[fieldKey] = `${countryCode}${val}`;
        }
      }
    });

    setVisitorData((prev) => ({
      ...prev,
      dynamicFields: processedFields,
      purposeOfVisit: trimmedPurpose,
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
              fields.map((f) => {
                const fieldKey = f.field_key || f.fieldKey;
                const isRequired = f.is_required || f.isRequired;
                const inputType = f.input_type || f.inputType || "text";
                const options = f.options_json || f.optionsJson || [];
                const val = visitorData.dynamicFields[fieldKey] !== undefined ? visitorData.dynamicFields[fieldKey] : (inputType === "checkbox" ? [] : "");
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
                if (["number", "email", "date", "time", "password", "url"].includes(inputType)) {
                  textType = inputType;
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
                    onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                    required={isRequired}
                    error={Boolean(error)}
                    helperText={error}
                    size="medium"
                    placeholder={f.label}
                    autoComplete="off"
                    InputLabelProps={["date", "time"].includes(inputType) ? { shrink: true } : {}}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 30,
                      },
                    }}
                  />
                );
              })
            )}
          </Stack>

          <Divider />

          <TextField
            fullWidth
            label="Purpose of Visit"
            value={purposeInput}
            onChange={(e) => {
              setPurposeInput(e.target.value);
              if (errors.purposeOfVisit) {
                setErrors((p) => {
                  const next = { ...p };
                  delete next.purposeOfVisit;
                  return next;
                });
              }
            }}
            required
            error={Boolean(errors.purposeOfVisit)}
            helperText={errors.purposeOfVisit}
            placeholder="Tell us why you're visiting"
            multiline
            rows={2}
            size="small"
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 30,
              },
            }}
          />

          <Divider />

          <FormControlLabel
            control={
              <Checkbox
                checked={ndaAccepted}
                onChange={(e) => setNdaAccepted(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2" fontWeight={600}>
                I have read and agree to the{" "}
                <Typography
                  component="span"
                  color="primary.main"
                  sx={{ textDecoration: "underline", cursor: "pointer" }}
                  onClick={(e) => {
                    e.preventDefault();
                    setNdaOpen(true);
                  }}
                >
                  NDA
                </Typography>
              </Typography>
            }
          />

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
              onClick={handleNext}
              sx={{ py: 1.5, borderRadius: 30 }}
            >
              Schedule
            </Button>
          </Stack>
        </Stack>
      </form>

      {/* NDA Modal */}
      <Dialog open={ndaOpen} onClose={() => setNdaOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={800} component="span" sx={{ fontFamily: "'Comfortaa', cursive" }}>
            Non-Disclosure Agreement
          </Typography>
          <IconButton onClick={() => setNdaOpen(false)}>
            <ICONS.close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: "rgba(0,0,0,0.05)" }}>
          <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.8, whiteSpace: "pre-line" }}>
            {"This Non-Disclosure Agreement (the \"Agreement\") is entered into for the purpose of preventing the unauthorized disclosure of Confidential Information as defined below.\n\n" +
              "1. Definition of Confidential Information: For purposes of this Agreement, \"Confidential Information\" shall include all information or material that has or could have commercial value or other utility in the business in which Disclosing Party is engaged.\n\n" +
              "2. Obligations of Receiving Party: Receiving Party shall hold and maintain the Confidential Information in strictest confidence for the sole and exclusive benefit of the Disclosing Party.\n\n" +
              "3. Legal Action: Any breach of this agreement may result in legal action and termination of access to the premises.\n\n" +
              "By accepting, you acknowledge that you have read and understood the terms of this agreement."}
          </Typography>
        </DialogContent>
      </Dialog>
    </VisitorLayout>
  );
}
