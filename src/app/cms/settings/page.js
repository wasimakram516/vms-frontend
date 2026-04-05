"use client";

import { Box, Typography, Divider, Button } from "@mui/material";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AppCard from "@/components/cards/AppCard";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import ICONS from "@/utils/iconUtil";
import RoleGuard from "@/components/auth/RoleGuard";

const SUPERADMIN_CARDS = [
  {
    icon: ICONS.business,
    label: "Host Details",
    description:
      "Set up your organization profile — name, logo, contact info, and more. This profile is displayed on visitor-facing communications and documents.",
    path: "/cms/settings/host-details",
  },
];

const DEV_CARDS = [
  {
    icon: ICONS.description,
    label: "NDA Templates",
    description:
      "Create and manage Non-Disclosure Agreement templates. Set one as active to use it in visitor check-in emails and the registration popup.",
    path: "/cms/settings/nda-templates",
  },
  {
    icon: ICONS.badge,
    label: "Badge Customization",
    description:
      "Design and customize visitor badges with fields, layout, QR codes, and styling. Create multiple templates and set one as default.",
    path: "/cms/settings/badge-customization",
  },
];

const SHARED_CARDS = [
  {
    icon: ICONS.apartment,
    label: "Departments",
    description:
      "Manage the departments available for visitor registrations. Visitors select a department when submitting a request.",
    path: "/cms/settings/departments",
  },
  {
    icon: ICONS.key,
    label: "Access Levels",
    description:
      "Define access levels (e.g. Restricted, General, Escorted) that admins assign to approved visits.",
    path: "/cms/settings/access-levels",
  },
  {
    icon: ICONS.diningTable,
    label: "Kitchen Menu",
    description:
      "Manage the food and beverages available in the staff kitchen. Add new items, update descriptions, and toggle availability.",
    path: "/cms/settings/kitchen-menu",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  const isDev = user?.role === "dev";

  const visibleCards = [
    ...(isDev ? DEV_CARDS : []),
    ...(!isDev ? SUPERADMIN_CARDS : []),
    ...(!isDev ? SHARED_CARDS : []),
  ];

  return (
    <RoleGuard allowedRoles={["superadmin", "admin", "dev"]}>
      <Box>
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
              {isDev
                ? "Developer controls — NDA templates and badge customization."
                : isSuperAdmin
                ? "System-wide configuration and content management."
                : "View system configuration. Contact a Super Admin to make changes."}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <ResponsiveCardGrid>
          {visibleCards.map(({ icon: Icon, label, description, path }) => {
            const isManage = isSuperAdmin || isDev;
            return (
              <AppCard key={path}>
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

                <Box sx={{ flexGrow: 1, px: 2.5, py: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {description}
                  </Typography>
                </Box>

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
                    variant={isManage ? "contained" : "outlined"}
                    size="small"
                    startIcon={isManage ? <ICONS.edit fontSize="small" /> : <ICONS.view fontSize="small" />}
                    onClick={() => router.push(path)}
                    sx={{ borderRadius: 30 }}
                  >
                    {isManage ? "Manage" : "View"}
                  </Button>
                </Box>
              </AppCard>
            );
          })}
        </ResponsiveCardGrid>
      </Box>
    </RoleGuard>
  );
}
