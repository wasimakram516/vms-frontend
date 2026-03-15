"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Divider,
  Button,
  Stack,
} from "@mui/material";
import { QRCodeCanvas } from "qrcode.react";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CloseIcon from "@mui/icons-material/Close";
import { useRef } from "react";
import { useMessage } from "@/contexts/MessageContext";
import slugify from "@/utils/slugify";
import ICONS from "@/utils/iconUtil";
import getStartIconSpacing from "@/utils/getStartIconSpacing";
import { useGlobalConfig } from "@/contexts/GlobalConfigContext";
import { downloadDefaultQrWrapperAsImage, hasDefaultQrWrapperDesign, hasWrapperDesign } from "@/utils/defaultQrWrapperDownload";

const translations = {
  en: {
    shareTitle: "Share Link",
    description: "Share this with others using the link or QR code below.",
    copySuccess: "Link copied to clipboard!",
    copyError: "Failed to copy link.",
    qrError: "QR Code generation failed.",
    downloadQR: "Download QR Code",
  },
  ,
};

export default function ShareLinkModal({
  open,
  onClose,
  url = "",
  qrUrl = "",
  title,
  description,
  name = "qr-code",
  customQrWrapper,
  useCustomQrCode = false,
}) {
  const qrCodeRef = useRef(null);
  const { showMessage } = useMessage();
  const t = translations.en || {};
  const dir = "ltr";
  const { globalConfig } = useGlobalConfig();

  const downloadName = `${slugify(name)}.png`;
  const qrValue = qrUrl || url;
  const hasCustomDesign = useCustomQrCode && customQrWrapper && hasWrapperDesign(customQrWrapper);
  const hasDefaultDesign = hasDefaultQrWrapperDesign(globalConfig);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showMessage(t.copySuccess, "info");
    } catch (error) {
      showMessage(t.copyError, "error");
    }
  };

  const handleDownloadQRCode = async () => {
    if (hasCustomDesign) {
      try {
        await downloadDefaultQrWrapperAsImage(customQrWrapper, qrValue, downloadName, {
          fonts: globalConfig?.fonts ?? [],
        });
      } catch (err) {
        showMessage(t.qrError, "error");
      }
      return;
    }
    if (hasDefaultDesign && globalConfig?.defaultQrWrapper) {
      try {
        await downloadDefaultQrWrapperAsImage(globalConfig.defaultQrWrapper, qrValue, downloadName, {
          fonts: globalConfig.fonts ?? [],
        });
      } catch (err) {
        showMessage(t.qrError, "error");
      }
      return;
    }
    const canvas = qrCodeRef.current?.querySelector("canvas");
    if (!canvas) {
      showMessage(t.qrError, "error");
      return;
    }
    const qrDataURL = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = qrDataURL;
    link.download = downloadName;
    link.click();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth dir={dir}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mx={2}
        mt={1}
      >
        <DialogTitle
          sx={{
            fontWeight: "bold",
            fontSize: "1.5rem",
            color: "primary.main",
            flex: 1,
            textAlign: "center",
          }}
        >
          {title || t.shareTitle}
        </DialogTitle>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>

      <DialogContent sx={{ backgroundColor: "#fff", textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {description || t.description}
        </Typography>

        {/* Shareable Link */}
        <Box
          sx={{
            backgroundColor: "#f9f9f9",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: 2,
            mb: 3,
            display: "flex",
            alignItems: "center",
          }}
        >
          <TextField
            value={url}
            fullWidth
            variant="standard"
            InputProps={{
              readOnly: true,
              disableUnderline: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleCopyLink}>
                    <ContentCopyIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* QR Code Section */}
        <Box
          ref={qrCodeRef}
          sx={{
            backgroundColor: "#f9f9f9",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <QRCodeCanvas
            value={qrValue}
            size={180}
            bgColor="#ffffff"
            includeMargin={true}
            style={{
              padding: "12px",
              background: "#ffffff",
              borderRadius: "8px",
            }}
          />

          <Button
            variant="contained"
            startIcon={<ICONS.download />}
            onClick={handleDownloadQRCode}
            sx={getStartIconSpacing(dir)}
          >
            {t.downloadQR}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
