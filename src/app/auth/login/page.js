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
import LoadingState from "@/components/LoadingState";
import VisitorLayout from "@/components/layout/VisitorLayout";
import { login } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { useMessage } from "@/contexts/MessageContext";
import { useColorMode } from "@/contexts/ThemeContext";

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
  const { mode } = useColorMode();
  const isDark = mode === "dark";

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
    return <LoadingState />;
  }

  return (
    <VisitorLayout 
      title="Staff Portal" 
      subtitle="Enter your credentials to access the Sinan VMS management tools."
      justifyContent="center"
    >
      <Box component="form" onSubmit={onSubmit}>
        <Typography
          sx={{
            fontFamily: "'Comfortaa', cursive",
            fontSize: "1.6rem",
            fontWeight: 800,
            color: "text.primary",
            mb: 0.5,
            textAlign: "center"
          }}
        >
          Staff sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: "center" }}>
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
                <ICONS.email sx={{ color: "text.secondary", fontSize: 18 }} />
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
                <ICONS.key sx={{ color: "text.secondary", fontSize: 18 }} />
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
          startIcon={loading ? <CircularProgress size={22} color="inherit" /> : <ICONS.login />}
          sx={{
            py: 1.5,
            borderRadius: 30,
            fontSize: "0.95rem",
            fontWeight: 700,
          }}
        >
          {loading ? "Signing..." : "Login"}
        </Button>
      </Box>
    </VisitorLayout>
  );
}
