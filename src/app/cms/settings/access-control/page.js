"use client";

import { Box, Typography, Button, Divider } from "@mui/material";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AppCard from "@/components/cards/AppCard";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import ICONS from "@/utils/iconUtil";
import PermissionRouteGuard from "@/components/auth/PermissionRouteGuard";
import { canAccessResource } from "@/utils/permissions";

const CARDS = [
  {
    icon: ICONS.key,
    label: "Permissions",
    description:
      "Create and manage permission resources. Each permission covers the four standard actions: read, create, update, and delete.",
    path: "/cms/settings/access-control/permissions",
  },
  {
    icon: ICONS.badge,
    label: "Role Permissions",
    description:
      "Assign a base permission set to each role type (Dept Admin, Kitchen Admin, Gate Staff, Kitchen Staff). Every user of that role inherits this set.",
    path: "/cms/settings/access-control/role-permissions",
  },
];

export default function AccessControlPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  const canManage = ["create", "update", "delete"].some((action) =>
    canAccessResource(user, "access-control", { hardcodeAllowed: isSuperAdmin, action })
  );

  return (
    <PermissionRouteGuard resource="access-control" hardcodeAllowed={isSuperAdmin}>
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
              Access Control
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Manage dynamic permissions, role base sets, and per-user overrides.
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <ResponsiveCardGrid>
          {CARDS.map(({ icon: Icon, label, description, path }) => (
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
                  variant={canManage ? "contained" : "outlined"}
                  size="small"
                  startIcon={canManage ? <ICONS.edit fontSize="small" /> : <ICONS.view fontSize="small" />}
                  onClick={() => router.push(path)}
                  sx={{ borderRadius: 30 }}
                >
                  {canManage ? "Manage" : "View"}
                </Button>
              </Box>
            </AppCard>
          ))}
        </ResponsiveCardGrid>
      </Box>
    </PermissionRouteGuard>
  );
}
