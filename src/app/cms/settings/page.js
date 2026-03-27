"use client";

import { Box, Typography, Divider, Button } from "@mui/material";
import { useRouter } from "next/navigation";
import AppCard from "@/components/cards/AppCard";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import ICONS from "@/utils/iconUtil";
import RoleGuard from "@/components/auth/RoleGuard";

const SETTING_CARDS = [
  {
    icon: ICONS.business,
    label: "Host Details",
    description:
      "Set up your organization profile — name, logo, contact info, and more. This profile is displayed on visitor-facing communications and documents.",
    path: "/cms/settings/host-details",
  },
  {
    icon: ICONS.description,
    label: "NDA Templates",
    description:
      "Create and manage Non-Disclosure Agreement templates. Set one as active to use it in visitor check-in emails and the registration popup.",
    path: "/cms/settings/nda-templates",
  },
];

export default function SettingsPage() {
  const router = useRouter();

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
              Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.8 }}>
              System-wide configuration and content management for SuperAdmins.
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <ResponsiveCardGrid>
          {SETTING_CARDS.map(({ icon: Icon, label, description, path }) => (
            <AppCard key={path}>
              {/* Card header */}
              <Box
                sx={{
                  bgcolor: "action.hover",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  p: 2.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon fontSize="small" />
                </Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {label}
                </Typography>
              </Box>

              {/* Card body */}
              <Box sx={{ flexGrow: 1, px: 2.5, py: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {description}
                </Typography>
              </Box>

              {/* Card footer */}
              <Box
                sx={{
                  px: 2.5,
                  pb: 2.5,
                  pt: 1,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  bgcolor: "action.hover",
                }}
              >
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<ICONS.edit fontSize="small" />}
                  onClick={() => router.push(path)}
                  sx={{ borderRadius: 30 }}
                >
                  Customize
                </Button>
              </Box>
            </AppCard>
          ))}
        </ResponsiveCardGrid>
      </Box>
    </RoleGuard>
  );
}
