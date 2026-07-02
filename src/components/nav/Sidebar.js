"use client";

import {
  Drawer,
  List,
  ListItem,
  IconButton,
  Tooltip,
  Box,
  Typography,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { useColorMode } from "@/contexts/ThemeContext";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useState } from "react";
import ICONS from "@/utils/iconUtil";
import { canAccessResource } from "@/utils/permissions";

// Full catalog: every CMS nav item with its pageId
const buildCatalog = (user, isKitchenModuleEnabled = true) => {
  const role = user?.role;
  const adminType = user?.role === "admin" ? (user?.adminType || "departmental") : user?.adminType;
  const isKitchenAdmin = role === "admin" && adminType === "kitchen";

  const items = [
    { label: "Dashboard", icon: ICONS.home, path: "/cms/dashboard", pageId: "dashboard" },
    { label: "Analytics", icon: ICONS.insights, path: "/cms/analytics", pageId: "analytics" },
    { label: "Visitors", icon: ICONS.badge, path: "/cms/visitors", pageId: "visitors" },
    { label: "Visits", icon: ICONS.checkin, path: "/cms/visits", pageId: "visits" },
    { label: "NDA Forms", icon: ICONS.verified, path: "/cms/nda-forms", pageId: "nda-forms" },
    { label: "Fields", icon: ICONS.form, path: "/cms/fields", pageId: "fields" },
    { label: "Users", icon: ICONS.people, path: "/cms/users", pageId: "users" },
    { label: "Settings", icon: ICONS.settings, path: "/cms/settings", pageId: "settings" },
  ];

  if (isKitchenModuleEnabled) {
    items.splice(items.length - 1, 0, { label: "Kitchen Orders", icon: ICONS.diningTable, path: "/cms/kitchen", pageId: "kitchen" });
  }

  return items;
};

const getNavItems = (user, isKitchenModuleEnabled = true) => {
  const role = user?.role;
  const isDev = role === "dev";

  if (isDev) {
    return [
      { label: "Settings", icon: ICONS.settings, path: "/cms/settings" },
    ];
  }

  const catalog = buildCatalog(user, isKitchenModuleEnabled);
  const isKitchenAdmin = role === "admin" && (user?.adminType || "departmental") === "kitchen";
  const isSuperAdmin = role === "superadmin";

  return catalog.filter((item) => {
    if (item.pageId === "dashboard") return !isKitchenAdmin;
    if (item.pageId === "settings") {
      if (isKitchenAdmin) {
        return canAccessResource(user, "kitchen-menu", { hardcodeAllowed: false });
      }
      if (isSuperAdmin) return true;
      const settingsPages = ["access-control", "host-details", "departments", "access-levels", "kitchen-menu"];
      return settingsPages.some((pageId) =>
        canAccessResource(user, pageId, { hardcodeAllowed: false, action: "read" }),
      );
    }
    if (isSuperAdmin) return true;
    return canAccessResource(user, item.pageId, { hardcodeAllowed: false });
  });
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { hostSettings } = useSettings();
  const theme = useTheme();
  const { mode } = useColorMode();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = getNavItems(user, hostSettings?.isKitchenModuleEnabled);

  const isActive = (path) =>
    path === "/cms" ? pathname === "/cms" : pathname.startsWith(path);

  const drawerContent = (
    <Box
      sx={{
        width: isMobile ? "auto" : 64,
        pt: 1,
        px: isMobile ? 2 : 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      {isMobile && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
          <IconButton size="large" color="error" onClick={() => setMobileOpen(false)}>
            <ICONS.close />
          </IconButton>
        </Box>
      )}

      <List sx={{ width: "100%" }}>
        {navItems.map(({ path, icon: Icon, label }) => (
          <ListItem
            key={label}
            disablePadding
            sx={{ mb: 0.5, justifyContent: isMobile ? "flex-start" : "center" }}
          >
            <Link href={path} style={{ width: "100%", textDecoration: "none" }} onClick={() => isMobile && setMobileOpen(false)}>
              <Box
                sx={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isMobile ? "flex-start" : "center",
                  gap: isMobile ? 2 : 0,
                  px: isMobile ? 1 : 0,
                }}
              >
                <Tooltip title={label} placement="right" disableHoverListener={isMobile}>
                  <IconButton
                    size="large"
                    sx={{
                      color: isActive(path) ? (mode === "dark" ? "#000" : "#fff") : "text.secondary",
                      bgcolor: isActive(path) ? (mode === "dark" ? "#fff" : "#000") : "transparent",
                      borderRadius: 30,
                      "&:hover": {
                        bgcolor: isActive(path) ? (mode === "dark" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)") : "action.hover",
                        color: isActive(path) ? (mode === "dark" ? "#000" : "#fff") : "primary.main",
                      },
                      transition: "all 0.2s ease",
                    }}
                  >
                    <Icon />
                  </IconButton>
                </Tooltip>

                {isMobile && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: isActive(path) ? "primary.main" : "text.primary",
                      fontWeight: isActive(path) ? 600 : 400,
                    }}
                  >
                    {label}
                  </Typography>
                )}
              </Box>
            </Link>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <>
      {/* Mobile menu button */}
      {isMobile && !mobileOpen && (
        <Box
          sx={{
            position: "fixed",
            top: 72,
            right: 16,
            zIndex: 1300,
            bgcolor: "background.paper",
            borderRadius: "50%",
            boxShadow: 3,
          }}
        >
          <Tooltip title="Menu">
            <IconButton size="large" color="primary" onClick={() => setMobileOpen(true)} sx={{ p: 1.5 }}>
              <ICONS.menu />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Desktop permanent sidebar */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: 64,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: 64,
              boxSizing: "border-box",
              bgcolor: "background.paper",
              borderRight: "1px solid rgba(0,0,0,0.08)",
              top: "64px",
              height: "calc(100% - 64px)",
              position: "fixed",
              zIndex: 1200,
              overflowX: "hidden",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer
          anchor="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            [`& .MuiDrawer-paper`]: {
              width: "75vw",
              maxWidth: 280,
              zIndex: 1400,
              boxShadow: 6,
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
    </>
  );
}
