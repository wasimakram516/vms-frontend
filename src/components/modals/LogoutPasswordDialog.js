"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
} from "@mui/material";
import ICONS from "@/utils/iconUtil";
import getStartIconSpacing from "@/utils/getStartIconSpacing";
import DialogHeader from "@/components/modals/DialogHeader";
import { verifyPassword } from "@/services/authService";
import useI18nLayout from "@/hooks/useI18nLayout";
import commonTranslations from "@/locales/common";
import { useMessage } from "@/contexts/MessageContext";

const LogoutPasswordDialog = ({ open, onClose, onConfirm }) => {
  const { t, language } = useI18nLayout(commonTranslations);
  const { showMessage } = useMessage();
  const dir = language === "ar" ? "rtl" : "ltr";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setShowPassword(false);
      setLoading(false);
    }
  }, [open]);

  const handleLogout = async () => {
    if (!password) return;
    setLoading(true);
    try {
      const result = await verifyPassword(password);
      if (result?.error) {
        const msg = String(result.message || "");
        showMessage(
          /invalid password/i.test(msg)
            ? t.navLogoutPasswordError
            : t.navLogoutPasswordGenericError,
          "error"
        );
        return;
      }
      await onConfirm();
    } catch {
      showMessage(t.navLogoutPasswordGenericError, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      disableScrollLock={true}
      PaperProps={{
        sx: {
          borderRadius: 4,
          padding: 2,
          maxWidth: "500px",
          width: "100%",
          backgroundColor: "background.paper",
          boxShadow: (theme) =>
            `0px 4px 10px ${theme.palette.mode === "dark" ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.1)"}`,
        },
      }}
    >
      <DialogHeader
        title={t.navLogoutPasswordTitle}
        onClose={!loading ? onClose : undefined}
        align="center"
        sx={{ pb: 1.25 }}
      />
      <DialogContent>
        <Box sx={{ textAlign: "center", margin: "1rem 0" }}>
          <DialogContentText
            sx={{
              fontSize: "1rem",
              color: "text.secondary",
              lineHeight: 1.6,
            }}
          >
            {t.navLogoutPasswordMessage}
          </DialogContentText>
          <TextField
            fullWidth
            autoFocus
            margin="normal"
            type={showPassword ? "text" : "password"}
            label={t.navLogoutPasswordField}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && password && !loading) handleLogout();
            }}
            disabled={loading}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword((v) => !v)}
                    edge="end"
                    size="small"
                    aria-label="toggle password visibility"
                  >
                    {showPassword ? (
                      <ICONS.hide fontSize="small" />
                    ) : (
                      <ICONS.view fontSize="small" />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mt: 2 }}
          />
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          display: "flex",
          justifyContent: "center",
          gap: 2,
          paddingBottom: "1rem",
        }}
      >
        <Button
          onClick={onClose}
          variant="outlined"
          color="primary"
          disabled={loading}
          startIcon={<ICONS.cancel />}
          sx={{
            fontWeight: "bold",
            textTransform: "uppercase",
            padding: "0.5rem 2rem",
            ...getStartIconSpacing(dir),
          }}
        >
          {t.cancel}
        </Button>
        <Button
          onClick={handleLogout}
          variant="contained"
          color="error"
          disabled={loading || !password}
          startIcon={
            loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <ICONS.logout />
            )
          }
          sx={{
            fontWeight: "bold",
            textTransform: "uppercase",
            padding: "0.5rem 2rem",
            ...getStartIconSpacing(dir),
          }}
        >
          {t.navLogout}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LogoutPasswordDialog;
