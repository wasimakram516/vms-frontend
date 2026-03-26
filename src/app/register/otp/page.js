"use client";

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Stack,
  Typography,
  CircularProgress,
  alpha,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import { sendOtp, verifyOtp } from "@/services/registrationService";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";

const OTP_LENGTH = 4;

export default function RegisterOtpPage() {
  const router = useRouter();
  const { visitorData, setVisitorData, setFlowState } = useVisitor();
  const [otp, setOtp] = useState(() => Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    const code = otp.join("");
    if (code.length === OTP_LENGTH && !loading && visitorData.identity) {
      handleVerify();
    }
  }, [otp, visitorData.identity]);

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleResend = async () => {
    if (resendTimer > 0 || resending || !visitorData.identity) return;

    setResending(true);
    try {
      const res = await sendOtp(visitorData.identity);
      if (!res.error) {
        setResendTimer(60);
        setOtp(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      }
    } finally {
      setResending(false);
    }
  };

  const fillOtp = (startIndex, rawValue) => {
    const digits = rawValue.replace(/\D/g, "");
    if (!digits) return;

    const nextOtp = [...otp];
    let lastFilledIndex = startIndex;

    digits
      .slice(0, OTP_LENGTH - startIndex)
      .split("")
      .forEach((digit, offset) => {
        const targetIndex = startIndex + offset;
        nextOtp[targetIndex] = digit;
        lastFilledIndex = targetIndex;
      });

    setOtp(nextOtp);
    inputRefs.current[Math.min(lastFilledIndex + 1, OTP_LENGTH - 1)]?.focus();
  };

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    if (value.length > 1) {
      fillOtp(index, value);
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      handleVerify();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    fillOtp(0, e.clipboardData.getData("text"));
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < OTP_LENGTH || loading) return;

    setLoading(true);
    console.log(`Verifying OTP: ${code} for Identity: ${visitorData.identity}`);
    try {
      const res = await verifyOtp(visitorData.identity, code);
      if (!res.error && res.success) {
        setFlowState((prev) => ({ 
          ...prev, 
          otpVerified: true, 
          ndaAccepted: true, 
          currentStep: "details" 
        }));

        setVisitorData((prev) => {
          const newData = { ...prev };
          
          if (res.user) {
            newData.userId = res.user.id;
            newData.fullName = res.user.fullName || prev.fullName;
            newData.email = res.user.email || prev.email;
            newData.phone = res.user.phone || prev.phone;
          }

          if (res.lastFieldValues) {
            newData.dynamicFields = {
              ...prev.dynamicFields,
              ...res.lastFieldValues
            };
            
            if (res.user?.fullName && !newData.dynamicFields.full_name) {
              newData.dynamicFields.full_name = res.user.fullName;
            }
            if (res.user?.email && !newData.dynamicFields.email) {
              newData.dynamicFields.email = res.user.email;
            }
            if (res.user?.phone && !newData.dynamicFields.phone) {
              newData.dynamicFields.phone = res.user.phone;
            }
          }

          return newData;
        });

        router.push("/register/details");
      } else {
        setOtp(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      }
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
            We've sent a 4-digit code to <Typography component="span" fontWeight={700} color="text.primary">{visitorData.identity || "your device"}</Typography>
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ my: 2 }}>
          {otp.map((digit, i) => (
            <Box
              key={i}
              component="input"
              ref={(node) => {
                inputRefs.current[i] = node;
              }}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              maxLength={1}
              autoComplete="one-time-code"
              autoFocus={i === 0}
              sx={{
                width: { xs: 45, sm: 55 },
                height: { xs: 45, sm: 55 },
                textAlign: "center",
                fontSize: "1.2rem",
                fontWeight: 800,
                borderRadius: 1,
                border: (theme) => `2px solid ${alpha(theme.palette.text.primary, 0.1)}`,
                bgcolor: (theme) => alpha(theme.palette.text.primary, 0.02),
                color: "text.primary",
                outline: "none",
                transition: "all 0.2s ease",
                "&:focus": {
                  borderColor: "primary.main",
                  bgcolor: "background.paper",
                  boxShadow: (theme) => `0 0 0 4px ${alpha(theme.palette.primary.main, 0.1)}`,
                  transform: "scale(1.05)",
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
          startIcon={loading ? <CircularProgress size={24} color="inherit" /> : <ICONS.checkCircle />}
          sx={{ py: 1.8, borderRadius: 30, fontWeight: 700 }}
        >
          {loading ? "Verifying..." : "Verify"}
        </Button>

        <Typography variant="caption" color="text.secondary" align="center">
          Didn't receive code?{" "}
          <Typography 
            component="span" 
            variant="caption" 
            onClick={handleResend}
            sx={{ 
              color: resendTimer > 0 || resending ? "text.disabled" : "primary.main", 
              cursor: resendTimer > 0 || resending ? "default" : "pointer", 
              fontWeight: 700,
              textDecoration: resendTimer > 0 || resending ? "none" : "hover",
              "&:hover": { textDecoration: resendTimer > 0 || resending ? "none" : "underline" }
            }}
          >
            {resending ? "Sending..." : resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend"}
          </Typography>
        </Typography>

        <Button
          variant="text"
          fullWidth
          size="small"
          startIcon={<ICONS.back />}
          onClick={() => router.back()}
          sx={{ color: "text.disabled", textTransform: "none" }}
        >
          Back
        </Button>
      </Stack>
    </VisitorLayout>
  );
}
