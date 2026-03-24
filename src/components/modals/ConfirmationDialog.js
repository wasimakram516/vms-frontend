"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  CircularProgress,
} from "@mui/material";
import ICONS from "@/utils/iconUtil";
import getStartIconSpacing from "@/utils/getStartIconSpacing";
import DialogHeader from "@/components/modals/DialogHeader";

const ConfirmationDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText,
  confirmButtonIcon,
  confirmButtonColor = "error",
}) => {
  const [loading, setLoading] = useState(false);

  const translations = {
    en: {
      cancel: "Cancel",
      yes: "Yes",
      processing: "Processing...",
    },
  };
  const t = translations.en;
  const dir = "ltr";

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? null : onClose}
      dir={dir}
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
        title={title}
        onClose={loading ? undefined : onClose}
        align="center"
        sx={{ pb: 1.25 }}
      />
      <DialogContent>
        <Box
          sx={{
            textAlign: "center",
            margin: "1rem 0",
          }}
        >
          <DialogContentText
            sx={{
              fontSize: "1rem",
              color: "text.secondary",
              lineHeight: 1.6,
            }}
          >
            {message}
          </DialogContentText>
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
          onClick={handleConfirm}
          variant="contained"
          color={confirmButtonColor}
          disabled={loading}
          startIcon={
            loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              confirmButtonIcon
            )
          }
          sx={{
            fontWeight: "bold",
            textTransform: "uppercase",
            padding: "0.5rem 2rem",
            ...getStartIconSpacing(dir),
          }}
        >
          {confirmButtonText || t.yes}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationDialog;
