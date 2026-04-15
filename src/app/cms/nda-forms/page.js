"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Divider,
  Button,
  Stack,
  Tooltip,
  IconButton,
  CircularProgress,
} from "@mui/material";
import ICONS from "@/utils/iconUtil";
import AppCard from "@/components/cards/AppCard";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import RoleGuard from "@/components/auth/RoleGuard";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import { useMessage } from "@/contexts/MessageContext";
import { getNdaForms, deleteNdaAcceptance, resendNdaToHost, resendNdaToVisitor } from "@/services/ndaAcceptanceService";
import { formatDateTimeWithLocale } from "@/utils/dateUtils";

export default function NdaFormsPage() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const { showMessage } = useMessage();

  const fetchForms = async () => {
    setLoading(true);
    try {
      const data = await getNdaForms();
      setForms(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchForms(); }, []);

  const handleAction = async (id, action, label) => {
    setActionLoading((p) => ({ ...p, [`${id}-${action}`]: true }));
    try {
      if (action === "resend-host") await resendNdaToHost(id);
      else if (action === "resend-visitor") await resendNdaToVisitor(id);
      showMessage(`${label} successful`, "success");
    } catch {
      showMessage(`${label} failed`, "error");
    } finally {
      setActionLoading((p) => ({ ...p, [`${id}-${action}`]: false }));
    }
  };

  const handleDelete = async () => {
    await deleteNdaAcceptance(deleteTarget.id);
    showMessage("NDA record deleted", "success");
    setDeleteTarget(null);
    await fetchForms();
  };

  return (
    <RoleGuard allowedRoles={["superadmin"]}>
      <Box>
        {/* Page header */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
            mt: 2,
            mb: 1,
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight="bold">
              NDA Forms
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
              Generated NDA documents for checked-in visitors.
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {loading ? (
          <LoadingState />
        ) : forms.length === 0 ? (
          <NoDataAvailable
            title="No NDA forms yet"
            description="NDA forms are generated automatically when a visitor checks in. They will appear here once available."
          />
        ) : (
          <ResponsiveCardGrid>
            {forms.map((form) => (
              <AppCard key={form.id} sx={{ height: "100%", width: "100%" }}>
                {/* Card header */}
                <Box
                  sx={{
                    bgcolor: "action.hover",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    p: 2,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={800} noWrap>
                      {form.user?.fullName || "Unknown Visitor"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {form.user?.email || "—"}
                    </Typography>
                  </Box>
                </Box>

                {/* Card body */}
                <Box sx={{ flexGrow: 1, px: 2, py: 1.5 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ICONS.description sx={{ fontSize: 15, color: "text.secondary", flexShrink: 0 }} />
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {form.ndaTemplate?.name || "NDA Template"}
                        {form.ndaTemplate?.version ? ` · v${form.ndaTemplate.version}` : ""}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ICONS.time sx={{ fontSize: 15, color: "text.secondary", flexShrink: 0 }} />
                      <Typography variant="body2" color="text.secondary">
                        Accepted {form.acceptedAt ? formatDateTimeWithLocale(form.acceptedAt) : "—"}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>

                {/* Card footer */}
                <Box
                  sx={{
                    px: 2,
                    pb: 2,
                    pt: 1,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    bgcolor: "action.hover",
                    display: "flex",
                    gap: 1,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {form.ndaFormUrl && (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<ICONS.download fontSize="small" />}
                      href={form.ndaFormUrl}
                      download
                      sx={{ borderRadius: 30, fontSize: "0.72rem" }}
                    >
                      Download
                    </Button>
                  )}
                  <Tooltip title="Resend to Host">
                    <span>
                      <IconButton
                        size="small"
                        color="primary"
                        disabled={!!actionLoading[`${form.id}-resend-host`]}
                        onClick={() => handleAction(form.id, "resend-host", "Resend to host")}
                        sx={{ bgcolor: "action.hover" }}
                      >
                        {actionLoading[`${form.id}-resend-host`]
                          ? <CircularProgress size={16} />
                          : <ICONS.email fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Resend to Visitor">
                    <span>
                      <IconButton
                        size="small"
                        color="secondary"
                        disabled={!!actionLoading[`${form.id}-resend-visitor`]}
                        onClick={() => handleAction(form.id, "resend-visitor", "Resend to visitor")}
                        sx={{ bgcolor: "action.hover" }}
                      >
                        {actionLoading[`${form.id}-resend-visitor`]
                          ? <CircularProgress size={16} />
                          : <ICONS.send fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Delete NDA Record">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteTarget(form)}
                      sx={{ bgcolor: "action.hover", ml: "auto" }}
                    >
                      <ICONS.delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </AppCard>
            ))}
          </ResponsiveCardGrid>
        )}
      </Box>

      <ConfirmationDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete NDA Record"
        message={`Delete the NDA record for "${deleteTarget?.user?.fullName ?? 'this visitor'}"? This cannot be undone.`}
        confirmButtonText="Delete"
        confirmButtonIcon={<ICONS.delete fontSize="small" />}
      />
    </RoleGuard>
  );
}
