"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import VisitorLayout from "@/components/layout/VisitorLayout";
import LoadingState from "@/components/LoadingState";
import { login } from "@/services/authService";
import ICONS from "@/utils/iconUtil";

const getStaffDestination = (staffUser) =>
  staffUser?.staffType === "kitchen" ? "/staff/kitchen" : "/staff/gate/verify";

export default function StaffLoginPage() {
  const router = useRouter();
  const { user, setUser, logout, loading: authLoading } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "staff") {
        router.replace(getStaffDestination(user));
      } else {
        router.replace("/cms/dashboard");
      }
    }
  }, [authLoading, router, user]);

  const onChange = (event) => {
    const { name, value } = event.target;
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

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await login(form.email, form.password);
      if (!response?.error) {
        if (response.user.role === "staff") {
          setUser(response.user);
          router.push(getStaffDestination(response.user));
        } else {
          await logout("/staff");
        }
      }
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
      subtitle="Sign in to access your staff tools and daily operations."
      justifyContent="center"
    >
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography
          sx={{
            fontFamily: "'Comfortaa', cursive",
            fontSize: "1.7rem",
            fontWeight: 800,
            color: "text.primary",
            mb: 1,
          }}
        >
          Staff sign in
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Use your staff credentials to continue.
        </Typography>
      </Box>

      <Box component="form" onSubmit={onSubmit}>
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
          type={showPassword ? "text" : "password"}
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
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={() => setShowPassword((prev) => !prev)}
                  edge="end"
                >
                  {showPassword ? <ICONS.hide /> : <ICONS.view />}
                </IconButton>
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
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </Box>
    </VisitorLayout>
  );
}
