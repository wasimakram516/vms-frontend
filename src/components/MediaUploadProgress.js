"use client";

import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Typography,
    LinearProgress,
    List,
    ListItem,
    IconButton,
    Alert,
    Chip,
    Paper,
} from "@mui/material";
import ICONS from "@/utils/iconUtil";

const MediaUploadProgress = ({ open, uploads, onClose, allowClose = false }) => {
    const allComplete = uploads.every((u) => u.percent === 100 || u.error);
    const hasErrors = uploads.some((u) => u.error);
    const uploadingCount = uploads.filter((u) => u.percent < 100 && !u.error).length;

    const getStatusColor = (upload) => {
        if (upload.error) return "#d32f2f";
        if (upload.percent === 100) return "#2e7d32";
        return "#128199"; // Primary color
    };

    const getStatusIcon = (upload) => {
        if (upload.error) {
            return (
                <ICONS.errorOutline
                    sx={{
                        color: "#d32f2f",
                        fontSize: 22,
                        animation: upload.error ? "pulse 0.5s ease-in-out" : "none"
                    }}
                />
            );
        }
        if (upload.percent === 100) {
            return (
                <ICONS.checkCircle
                    sx={{
                        color: "#2e7d32",
                        fontSize: 22,
                        animation: "scaleIn 0.3s ease-out"
                    }}
                />
            );
        }
        return (
            <Box
                sx={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: "2px solid #128199",
                    borderTopColor: "transparent",
                    animation: "spin 0.8s linear infinite",
                }}
            />
        );
    };

    return (
        <>
            <Dialog
                open={open}
                onClose={allowClose || allComplete ? onClose : undefined}
                maxWidth="sm"
                fullWidth
                disableEscapeKeyDown={!allowClose && !allComplete}
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        boxShadow: "0px 10px 32px rgba(0,0,0,0.15)",
                        overflow: "hidden",
                    }
                }}
            >
                <DialogTitle
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: allComplete
                            ? "linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)"
                            : "linear-gradient(135deg, #128199 0%, #0077b6 100%)",
                        color: "#ffffff",
                        py: 2.5,
                        px: 3,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        {!allComplete && (
                            <Box
                                sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    bgcolor: "rgba(255,255,255,0.2)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <ICONS.cloud sx={{ color: "#ffffff", fontSize: 18 }} />
                            </Box>
                        )}
                        {allComplete && (
                            <Box
                                sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    bgcolor: "rgba(255,255,255,0.2)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <ICONS.checkCircle sx={{ color: "#ffffff", fontSize: 18 }} />
                            </Box>
                        )}
                        <Box>
                            <Typography fontWeight={700} fontSize="1.1rem" sx={{ color: "#ffffff" }}>
                                {allComplete ? "Upload Complete" : "Uploading Media"}
                            </Typography>
                            {!allComplete && uploadingCount > 0 && (
                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.9)", fontSize: "0.75rem" }}>
                                    {uploadingCount} {uploadingCount === 1 ? "file" : "files"} uploading...
                                </Typography>
                            )}
                        </Box>
                    </Box>
                    {(allowClose || allComplete) && (
                        <IconButton
                            onClick={onClose}
                            size="small"
                            sx={{
                                color: "#ffffff",
                                "&:hover": {
                                    bgcolor: "rgba(255,255,255,0.15)",
                                }
                            }}
                        >
                            <ICONS.close />
                        </IconButton>
                    )}
                </DialogTitle>
                <DialogContent sx={{ px: 3, py: 3, bgcolor: "#f9f9f9" }}>
                    {hasErrors && (
                        <Alert
                            severity="error"
                            sx={{
                                mb: 2.5,
                                borderRadius: 2,
                                boxShadow: "0px 2px 8px rgba(211, 47, 47, 0.15)",
                            }}
                            icon={<ICONS.errorOutline />}
                        >
                            Some uploads failed. Please try again.
                        </Alert>
                    )}
                    <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
                        {uploads.map((upload, index) => (
                            <Paper
                                key={index}
                                elevation={0}
                                sx={{
                                    p: 2.5,
                                    borderRadius: 2,
                                    bgcolor: "#ffffff",
                                    border: `1px solid ${upload.error ? "#ffebee" : upload.percent === 100 ? "#e8f5e9" : "#e3f2fd"}`,
                                    boxShadow: "0px 2px 8px rgba(0,0,0,0.06)",
                                    transition: "all 0.3s ease",
                                    "&:hover": {
                                        boxShadow: "0px 4px 12px rgba(0,0,0,0.1)",
                                        transform: "translateY(-1px)",
                                    }
                                }}
                            >
                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                            variant="body2"
                                            fontWeight={600}
                                            sx={{
                                                color: "#033649",
                                                mb: 0.5,
                                                fontSize: "0.95rem",
                                            }}
                                        >
                                            {upload.label}
                                        </Typography>
                                        {upload.percent < 100 && upload.loaded && upload.total && (
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: "#555",
                                                    fontSize: "0.8rem",
                                                    display: "block",
                                                }}
                                            >
                                                {(upload.loaded / 1024 / 1024).toFixed(2)} MB / {(upload.total / 1024 / 1024).toFixed(2)} MB
                                            </Typography>
                                        )}
                                    </Box>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, ml: 2 }}>
                                        <Chip
                                            label={`${upload.percent}%`}
                                            size="small"
                                            sx={{
                                                bgcolor: upload.error
                                                    ? "#ffebee"
                                                    : upload.percent === 100
                                                        ? "#e8f5e9"
                                                        : "#e3f2fd",
                                                color: getStatusColor(upload),
                                                fontWeight: 600,
                                                fontSize: "0.75rem",
                                                height: 24,
                                                minWidth: 50,
                                            }}
                                        />
                                        {getStatusIcon(upload)}
                                    </Box>
                                </Box>
                                <Box sx={{ position: "relative", mb: upload.error ? 1 : 0 }}>
                                    <LinearProgress
                                        variant="determinate"
                                        value={upload.percent}
                                        sx={{
                                            height: 8,
                                            borderRadius: 4,
                                            bgcolor: upload.error
                                                ? "#ffebee"
                                                : upload.percent === 100
                                                    ? "#e8f5e9"
                                                    : "#e3f2fd",
                                            "& .MuiLinearProgress-bar": {
                                                borderRadius: 4,
                                                bgcolor: getStatusColor(upload),
                                                transition: "all 0.3s ease",
                                                boxShadow: upload.percent === 100
                                                    ? "0px 2px 8px rgba(46, 125, 50, 0.3)"
                                                    : "0px 2px 4px rgba(18, 129, 153, 0.2)",
                                            }
                                        }}
                                    />
                                </Box>
                                {upload.error && (
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: "#d32f2f",
                                            fontSize: "0.8rem",
                                            mt: 1,
                                            display: "block",
                                        }}
                                    >
                                        {upload.error}
                                    </Typography>
                                )}
                            </Paper>
                        ))}
                    </List>
                </DialogContent>
            </Dialog>
            <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
        </>
    );
};

export default MediaUploadProgress;

