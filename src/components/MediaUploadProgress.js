"use client";

import { useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Typography,
    LinearProgress,
    List,
    Alert,
    Chip,
    Paper,
    useTheme,
    alpha,
} from "@mui/material";
import ICONS from "@/utils/iconUtil";

const KEYFRAMES = `
@keyframes mup-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes mup-scaleIn {
  from { transform: scale(0); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
@keyframes mup-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
`;

const MediaUploadProgress = ({ open, uploads = [], onClose }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    useEffect(() => {
        const el = document.createElement("style");
        el.setAttribute("data-mup-keyframes", "1");
        el.textContent = KEYFRAMES;
        document.head.appendChild(el);
        return () => { document.head.removeChild(el); };
    }, []);

    const allComplete = uploads.length > 0 && uploads.every((u) => u.percent === 100 || u.error);
    const hasErrors = uploads.some((u) => u.error);
    const uploadingCount = uploads.filter((u) => u.percent < 100 && !u.error).length;

    // Auto-close when all complete (no errors)
    useEffect(() => {
        if (allComplete && !hasErrors && onClose) {
            const t = setTimeout(onClose, 800);
            return () => clearTimeout(t);
        }
    }, [allComplete, hasErrors, onClose]);

    const statusColor = (upload) => {
        if (upload.error) return theme.palette.error.main;
        if (upload.percent === 100) return theme.palette.success.main;
        return theme.palette.primary.main;
    };

    const trackColor = (upload) => {
        if (upload.error) return alpha(theme.palette.error.main, isDark ? 0.18 : 0.1);
        if (upload.percent === 100) return alpha(theme.palette.success.main, isDark ? 0.18 : 0.1);
        return alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1);
    };

    const cardBorderColor = (upload) => {
        if (upload.error) return alpha(theme.palette.error.main, isDark ? 0.3 : 0.2);
        if (upload.percent === 100) return alpha(theme.palette.success.main, isDark ? 0.3 : 0.2);
        return alpha(theme.palette.primary.main, isDark ? 0.3 : 0.15);
    };

    const StatusIcon = ({ upload }) => {
        if (upload.error) return (
            <ICONS.errorOutline sx={{ color: theme.palette.error.main, fontSize: 22, animation: "mup-pulse 0.5s ease-in-out" }} />
        );
        if (upload.percent === 100) return (
            <ICONS.checkCircle sx={{ color: theme.palette.success.main, fontSize: 22, animation: "mup-scaleIn 0.3s ease-out" }} />
        );
        return (
            <Box sx={{
                width: 20, height: 20, borderRadius: "50%",
                border: `2px solid ${theme.palette.primary.main}`,
                borderTopColor: "transparent",
                animation: "mup-spin 0.8s linear infinite",
            }} />
        );
    };

    return (
        <Dialog
            open={open}
            onClose={undefined}
            maxWidth="sm"
            fullWidth
            disableEscapeKeyDown
            PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
        >
            <DialogTitle sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                background: allComplete
                    ? `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${theme.palette.success.main} 100%)`
                    : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                color: "#fff",
                py: 2.5,
                px: 3,
            }}>
                <Box sx={{
                    width: 32, height: 32, borderRadius: "50%",
                    bgcolor: "rgba(255,255,255,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                    {allComplete
                        ? <ICONS.checkCircle sx={{ color: "#fff", fontSize: 18 }} />
                        : <ICONS.cloud sx={{ color: "#fff", fontSize: 18 }} />
                    }
                </Box>
                <Box>
                    <Typography fontWeight={700} fontSize="1.1rem" sx={{ color: "#fff" }}>
                        {allComplete ? "Upload Complete" : "Uploading…"}
                    </Typography>
                    {!allComplete && uploadingCount > 0 && (
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.85)", fontSize: "0.75rem" }}>
                            {uploadingCount} {uploadingCount === 1 ? "file" : "files"} uploading…
                        </Typography>
                    )}
                </Box>
            </DialogTitle>

            <DialogContent sx={{ px: 3, py: 3, bgcolor: "background.paper" }}>
                {hasErrors && (
                    <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
                        Some uploads failed. Please try again.
                    </Alert>
                )}
                <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 2, mt: hasErrors ? 0 : 1 }}>
                    {uploads.map((upload, i) => (
                        <Paper
                            key={i}
                            elevation={0}
                            sx={{
                                p: 2.5,
                                borderRadius: 2,
                                bgcolor: "action.hover",
                                border: `1px solid ${cardBorderColor(upload)}`,
                                transition: "all 0.3s ease",
                            }}
                        >
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>
                                        {upload.label}
                                    </Typography>
                                    {upload.percent < 100 && upload.loaded > 0 && upload.total > 0 && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                            {(upload.loaded / 1024 / 1024).toFixed(2)} MB / {(upload.total / 1024 / 1024).toFixed(2)} MB
                                        </Typography>
                                    )}
                                </Box>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, ml: 2 }}>
                                    <Chip
                                        label={`${upload.percent}%`}
                                        size="small"
                                        sx={{
                                            bgcolor: trackColor(upload),
                                            color: statusColor(upload),
                                            fontWeight: 600,
                                            fontSize: "0.75rem",
                                            height: 24,
                                            minWidth: 50,
                                        }}
                                    />
                                    <StatusIcon upload={upload} />
                                </Box>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={upload.percent}
                                sx={{
                                    height: 8,
                                    borderRadius: 4,
                                    bgcolor: trackColor(upload),
                                    "& .MuiLinearProgress-bar": {
                                        borderRadius: 4,
                                        bgcolor: statusColor(upload),
                                        transition: "all 0.3s ease",
                                    },
                                }}
                            />
                            {upload.error && (
                                <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
                                    {upload.error}
                                </Typography>
                            )}
                        </Paper>
                    ))}
                </List>
            </DialogContent>
        </Dialog>
    );
};

export default MediaUploadProgress;
