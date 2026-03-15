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

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import ICONS from "@/utils/iconUtil";

const getNavItems = () => {
  const base = [
    { label: "Dashboard", icon: ICONS.home, path: "/cms/dashboard" },
    { label: "Registrations", icon: ICONS.appRegister, path: "/cms/registrations" },
    { label: "Approvals", icon: ICONS.checkCircle, path: "/cms/approvals" },
    { label: "Fields", icon: ICONS.form, path: "/cms/fields" },
  ];

  return base;
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = getNavItems(user?.role);

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
                      color: isActive(path) ? "white" : "text.secondary",
                      bgcolor: isActive(path) ? "primary.main" : "transparent",
                      borderRadius: 2,
                      "&:hover": {
                        bgcolor: isActive(path) ? "primary.dark" : "action.hover",
                        color: isActive(path) ? "white" : "primary.main",
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
