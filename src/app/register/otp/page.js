"use client";

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  CircularProgress,
  Divider,
  alpha 
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import { useMessage } from "@/contexts/MessageContext";
import { verifyOtp } from "@/services/registrationService";
import { motion } from "framer-motion";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";

const transition = { duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] };

export default function RegisterOtpPage() {
  const router = useRouter();
  const { showMessage } = useMessage();
  const { visitorData, setVisitorData, setFlowState } = useVisitor();
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    if (otp.join("").length === 4 && !loading) {
      handleVerify();
    }
  }, [otp]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
    if (e.key === "Enter") {
      handleVerify();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 4 || loading) return;

    setLoading(true);
    try {
      const res = await verifyOtp(visitorData.identity, code);
      if (res.success) {
        setFlowState((prev) => ({ ...prev, otpVerified: true, ndaAccepted: true, currentStep: "details" }));
        if (res.user) {
          setVisitorData((prev) => ({
            ...prev,
            userId: res.user.id,
            fullName: res.user.full_name,
            email: res.user.email,
            phone: res.user.phone,
            dynamicFields: {
              ...prev.dynamicFields,
              full_name: res.user.full_name || "",
              email: res.user.email || (prev.identity?.includes("@") ? prev.identity : ""),
              phone: res.user.phone || (!prev.identity?.includes("@") ? prev.identity : ""),
            }
          }));
        }
        showMessage("Identity verified! Please confirm your details.", "success");
        router.push("/register/details");
      }
    } catch (err) {
      showMessage(err.message || "Invalid OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <VisitorLayout justifyContent="center">
      <Stack spacing={3}>
        <Box sx={{ textAlign: "center", mb: 2 }}>
          <Typography variant="h5" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive" }}>
            Verify Identity
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            We've sent a code to <Typography component="span" fontWeight={700} color="text.primary">{visitorData.identity || "your device"}</Typography>
          </Typography>
        </Box>

        <Stack direction="row" spacing={2} justifyContent="center" sx={{ my: 2 }}>
          {otp.map((digit, i) => (
            <Box
              key={i}
              component="input"
              ref={inputRefs[i]}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              maxLength={1}
              autoComplete="one-time-code"
              autoFocus={i === 0}
              sx={{
                width: { xs: 45, sm: 55 },
                height: { xs: 55, sm: 65 },
                textAlign: "center",
                fontSize: "1.2rem",
                fontWeight: 800,
                borderRadius: 3,
                border: (theme) => `2px solid ${alpha(theme.palette.text.primary, 0.1)}`,
                bgcolor: (theme) => alpha(theme.palette.text.primary, 0.02),
                color: "text.primary",
                outline: "none",
                "&:focus": {
                  borderColor: "primary.main",
                  bgcolor: "background.paper",
                  boxShadow: (theme) => `0 0 0 4px ${alpha(theme.palette.primary.main, 0.1)}`,
                },
              }}
            />
          ))}
        </Stack>

        <Button
          variant="contained"
          fullWidth
          size="large"
          disabled={loading}
          onClick={handleVerify}
          sx={{ py: 1.8, borderRadius: 30, fontWeight: 700 }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : "Verify and Continue"}
        </Button>

        <Typography variant="caption" color="text.secondary" align="center">
          Didn't receive code?{" "}
          <Typography 
            component="span" 
            variant="caption" 
            onClick={() => {/* resend logic */}}
            sx={{ 
              color: "primary.main", 
              cursor: "pointer", 
              fontWeight: 700,
              "&:hover": { textDecoration: "underline" }
            }}
          >
            Resend
          </Typography>
        </Typography>

        <Button
          variant="text"
          fullWidth
          size="small"
          onClick={() => router.back()}
          sx={{ color: "text.disabled", textTransform: "none" }}
        >
          Back to Identity
        </Button>
      </Stack>
    </VisitorLayout>
  );
}
