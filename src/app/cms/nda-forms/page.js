"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Divider,
  Button,
  Stack,
} from "@mui/material";
import ICONS from "@/utils/iconUtil";
import AppCard from "@/components/cards/AppCard";
import LoadingState from "@/components/LoadingState";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import RoleGuard from "@/components/auth/RoleGuard";
import { getNdaForms } from "@/services/ndaAcceptanceService";
import { formatDateTimeWithLocale } from "@/utils/dateUtils";

export default function NdaFormsPage() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getNdaForms();
        setForms(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
                  }}
                >
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<ICONS.download fontSize="small" />}
                    href={form.ndaFormUrl}
                    download
                    sx={{ borderRadius: 30, fontSize: "0.72rem", flex: 1 }}
                  >
                    Download
                  </Button>
                </Box>
              </AppCard>
            ))}
          </ResponsiveCardGrid>
        )}
      </Box>
    </RoleGuard>
  );
}
