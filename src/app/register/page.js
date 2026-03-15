"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  MenuItem,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import { DEFAULT_ISO_CODE } from "@/utils/countryCodes";
import DateTimeFieldFlatpickr from "@/components/forms/DateTimeFieldFlatpickr";
import ICONS from "@/utils/iconUtil";
import { createRegistration } from "@/services/registrationService";
import { downloadDefaultQrWrapperAsImage } from "@/utils/defaultQrWrapperDownload";
import { useGlobalConfig } from "@/contexts/GlobalConfigContext";

export default function RegisterPage() {
  const router = useRouter();
  const { globalConfig } = useGlobalConfig();
  const [fields, setFields] = useState([
    { id: "1", field_key: "full_name", label: "Full Name", input_type: "text", is_required: true },
    { id: "2", field_key: "email", label: "Email", input_type: "email", is_required: true },
    { id: "3", field_key: "phone", label: "Phone Number", input_type: "phone", is_required: false },
    { id: "4", field_key: "purpose", label: "Purpose of Visit", input_type: "select", is_required: true, options_json: ["Meeting", "Delivery", "Interview", "Other"] },
    { id: "5", field_key: "arrival", label: "Expected Arrival", input_type: "date", is_required: true },
  ]);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    iso_code: DEFAULT_ISO_CODE,
    purpose: "",
    arrival: ""
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = () => {
    const nextErrors = {};
    fields.forEach((f) => {
      const val = formData[f.field_key];
      if (f.is_required && !val) {
        nextErrors[f.field_key] = `${f.label} is required`;
      }
      if (f.input_type === "email" && val) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val)) nextErrors[f.field_key] = "Invalid email address";
      }
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Simulate API call
      const res = await createRegistration(formData);
      const mockResult = res || {
        token: `SN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        full_name: formData.full_name || "Visitor",
      };
      setSuccessData(mockResult);
    } catch (err) {
      console.error("Registration failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadQR = async () => {
    if (!successData?.token) return;
    
    // Use the download utility
    if (globalConfig?.defaultQrWrapper) {
      try {
        await downloadDefaultQrWrapperAsImage(
          globalConfig.defaultQrWrapper,
          successData.token,
          `QR-${successData.token}.png`,
          { fonts: globalConfig.fonts || [] }
        );
        return;
      } catch (err) {
        console.error("QR download failed, falling back to basic", err);
      }
    }

    // Fallback to basic download if no wrapper is configured
    const svg = document.querySelector("#vms-qr-code svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR-${successData.token}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 3,
          backdropFilter: "blur(12px)",
          backgroundColor: "rgba(255,255,255,0.7)",
          border: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          maxWidth: 480,
          mx: "auto",
        }}
      >
        <Stack alignItems="center" spacing={0.5} mb={2.5}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 1,
              background: "linear-gradient(135deg, #128199 0%, #0077b6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              mb: 0.5,
            }}
          >
            <ICONS.appRegister sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h6" fontWeight={800} textAlign="center" sx={{ fontFamily: "'Comfortaa', cursive", lineHeight: 1.2 }}>
            Visitor Registration
          </Typography>
          <Typography color="text.secondary" textAlign="center" variant="caption">
            Fill in your details to request facility access.
          </Typography>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack spacing={1.5}>
            {fields.map((field) => {
              const { field_key, label, input_type, is_required, options_json } = field;
              const error = errors[field_key];

              if (input_type === "date" || input_type === "datetime") {
                return (
                  <DateTimeFieldFlatpickr
                    key={field_key}
                    label={label}
                    value={formData[field_key]}
                    onChange={(val) => handleChange(field_key, val)}
                    required={is_required}
                    error={Boolean(error)}
                    helperText={error}
                    size="small"
                  />
                );
              }

              if (field.input_type === "phone") {
                return (
                  <TextField
                    key={field.id}
                    fullWidth
                    label={field.label}
                    required={field.is_required}
                    size="small"
                    value={formData[field.field_key] || ""}
                    onChange={(e) => handleChange(field.field_key, e.target.value)}
                    error={Boolean(error)}
                    helperText={error}
                    InputProps={{
                      startAdornment: (
                        <CountryCodeSelector
                          value={formData.iso_code}
                          onChange={(iso) => setFormData(prev => ({ ...prev, iso_code: iso }))}
                        />
                      ),
                    }}
                  />
                );
              }

              if (input_type === "select") {
                return (
                  <TextField
                    key={field_key}
                    select
                    fullWidth
                    size="small"
                    label={label}
                    required={is_required}
                    value={formData[field_key] || ""}
                    onChange={(e) => handleChange(field_key, e.target.value)}
                    error={Boolean(error)}
                    helperText={error}
                  >
                    {(options_json || []).map((opt) => (
                      <MenuItem key={opt} value={opt} sx={{ py: 0.5, fontSize: "0.85rem" }}>
                        {opt}
                      </MenuItem>
                    ))}
                  </TextField>
                );
              }

              return (
                <TextField
                  key={field_key}
                  fullWidth
                  size="small"
                  label={label}
                  required={is_required}
                  type={input_type === "phone" ? "tel" : input_type}
                  multiline={input_type === "textarea"}
                  rows={input_type === "textarea" ? 2 : 1}
                  value={formData[field_key] || ""}
                  onChange={(e) => handleChange(field_key, e.target.value)}
                  error={Boolean(error)}
                  helperText={error}
                />
              );
            })}

            <Button
              type="submit"
              variant="contained"
              size="medium"
              disabled={submitting}
              sx={{
                py: 1,
                fontSize: "0.9rem",
                borderRadius: "20px",
                mt: 1,
                fontWeight: 700,
              }}
            >
              {submitting ? <CircularProgress size={20} color="inherit" /> : "Submit Request"}
            </Button>
          </Stack>
        </form>
      </Paper>

      {/* Success Dialog */}
      <Dialog
        open={Boolean(successData)}
        onClose={() => router.push("/")}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: 2 } }}
      >
        <DialogTitle sx={{ textAlign: "center", pb: 0 }}>
          <ICONS.checkCircle sx={{ fontSize: 64, color: "success.main", mb: 2 }} />
          <Typography component="div" variant="h5" fontWeight={800}>
            Successful!
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          <Typography color="text.secondary" mb={3}>
            Your registration has been submitted. Please save your QR token below for check-in.
          </Typography>
          
          <Box
            sx={{
              p: 3,
              bgcolor: "rgba(0,0,0,0.03)",
              borderRadius: 3,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box id="vms-qr-code">
              <QRCodeSVG value={successData?.token || ""} size={160} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Verification Token
              </Typography>
              <Typography variant="h6" fontWeight={800} letterSpacing={2}>
                {successData?.token}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ICONS.download />}
              onClick={handleDownloadQR}
              sx={{ mt: 1, borderRadius: "20px", textTransform: "none", fontSize: "0.8rem", fontWeight: 700 }}
            >
              Download QR Image
            </Button>
          </Box>
          
          <Alert severity="info" sx={{ mt: 3, textAlign: "left", borderRadius: 2 }}>
            You will receive an email confirmation once your request is approved.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
          <Button variant="contained" onClick={() => router.push("/")} fullWidth sx={{ py: 1.2 }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}