"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  CircularProgress,
  GlobalStyles,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ICONS from "@/utils/iconUtil";
import { login } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { useMessage } from "@/contexts/MessageContext";

const transition = { duration: 0.6, ease: [0.43, 0.13, 0.23, 0.96] };

const fontStyles = (
  <GlobalStyles
    styles={`
      @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700&display=swap');
    `}
  />
);

export default function LoginPage() {
  const router = useRouter();
  const { user, setUser, loading: authLoading } = useAuth();
  const { showMessage } = useMessage();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "staff") {
        router.replace("/staff/gate/verify");
      } else {
        router.replace("/cms/dashboard");
      }
    }
  }, [user, authLoading, router]);

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const next = {};
    if (!form.email) next.email = "Email is required";
    if (!form.password) next.password = "Password is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await login(form.email, form.password);
      setUser(response.user);

      if (response.user.role === "staff") {
        router.push("/staff/gate/verify");
      } else {
        router.push("/cms/dashboard");
      }
    } catch (err) {
      showMessage(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || user) {
    return (
      <Box
        sx={{
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      {fontStyles}
      <Box
        sx={{
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          style={{ width: "100%", maxWidth: 860 }}
        >
          <Box
            sx={{
              display: "flex",
              minHeight: 480,
              borderRadius: 4,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            {/* Left Panel */}
            <Box
              sx={{
                flex: "0 0 42%",
                background: "linear-gradient(135deg, #128199 0%, #0077b6 100%)",
                display: { xs: "none", sm: "flex" },
                flexDirection: "column",
                justifyContent: "center",
                p: { xs: 4, md: 5 },
                position: "relative",
                overflow: "hidden",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: -80,
                  right: -80,
                  width: 240,
                  height: 240,
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "50%",
                },
                "&::after": {
                  content: '""',
                  position: "absolute",
                  bottom: -60,
                  left: -60,
                  width: 180,
                  height: 180,
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "50%",
                },
              }}
            >
              <Typography
                sx={{
                  fontFamily: "'Comfortaa', cursive",
                  fontSize: { md: "2rem" },
                  fontWeight: 800,
                  lineHeight: 1.15,
                  color: "#fff",
                  mb: 2,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                Sinan Visitor
                <br />
                <span style={{ color: "rgba(255,255,255,0.6)" }}>
                  Management
                </span>
                <br />
                Portal
              </Typography>
              <Typography
                sx={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.8)",
                  lineHeight: 1.7,
                  maxWidth: 200,
                  position: "relative",
                  zIndex: 1,
                  fontWeight: 500
                }}
              >
                Controlled access. Real-time tracking. Complete audit trail.
              </Typography>
            </Box>

            {/* Right Panel */}
            <Box
              component="form"
              onSubmit={onSubmit}
              sx={{
                flex: 1,
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                p: { xs: 4, md: 5 },
              }}
            >
              <Typography
                sx={{
                  fontFamily: "'Comfortaa', cursive",
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  color: "text.primary",
                  mb: 0.5,
                }}
              >
                Staff sign in
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                Enter your credentials to access the{" "}
                <strong>{"Sinan VMS"}</strong> portal.
              </Typography>

              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                error={Boolean(errors.email)}
                helperText={errors.email}
                sx={{ mb: 2.5 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ICONS.email sx={{ color: "text.disabled", fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Password"
                name="password"
                type="password"
                value={form.password}
                onChange={onChange}
                error={Boolean(errors.password)}
                helperText={errors.password}
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ICONS.key sx={{ color: "text.disabled", fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(18,129,153,0.15)",
                  "&:hover": { boxShadow: "0 6px 20px rgba(18,129,153,0.25)" }
                }}
              >
                {loading ? (
                  <CircularProgress size={22} color="inherit" />
                ) : (
                  "Sign in"
                )}
              </Button>
            </Box>
          </Box>
        </motion.div>
      </Box>
    </>
  );
}