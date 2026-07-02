"use client";

import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Stack,
  Typography,
  Tooltip,
} from "@mui/material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useColorMode } from "@/contexts/ThemeContext";
import useI18nLayout from "@/hooks/useI18nLayout";
import commonTranslations from "@/locales/common";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import LanguageSwitcher from "@/components/LanguageSwitcher";

import ICONS from "@/utils/iconUtil";

import { getStaffDestination } from "@/utils/navigationUtils";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { mode, toggleColorMode } = useColorMode();
  const { t } = useI18nLayout(commonTranslations);
  const pathname = usePathname();
  const router = useRouter();
  const brandLogo = mode === "dark" ? "/logo-mark-light.png" : "/logo-mark-dark.png";
  const isStaffArea = pathname?.startsWith("/staff");
  const isCmsArea = pathname?.startsWith("/cms");
  const isVisitorArea = !isStaffArea && !isCmsArea;
  const isGateStaffArea = pathname?.startsWith("/staff/gate");
  const kitchenAdmin = user?.adminType === "kitchen";

  const brandHref = isStaffArea ? "/staff" : kitchenAdmin ? "/cms/kitchen" : "/";

  const [anchorEl, setAnchorEl] = useState(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  
  useEffect(() => {
    if (!user) {
      setConfirmLogout(false);
      setAnchorEl(null);
    }
  }, [user]);

  const avatarButtonStyle = {
    p: 0,
    borderRadius: "50%",
    width: 30,
    height: 30,
    backgroundColor: "background.paper",
    transition: "box-shadow 0.3s ease",
    boxShadow: `
    2px 2px 6px rgba(0, 0, 0, 0.15),
    -2px -2px 6px rgba(255, 255, 255, 0.5),
    inset 2px 2px 5px rgba(0, 0, 0, 0.2),
    inset -2px -2px 5px rgba(255, 255, 255, 0.7)
  `,
    "&:hover": {
      boxShadow: `
      3px 3px 8px rgba(0, 0, 0, 0.2),
      -3px -3px 8px rgba(255, 255, 255, 0.6),
      inset 2px 2px 5px rgba(0, 0, 0, 0.2),
      inset -2px -2px 5px rgba(255, 255, 255, 0.7)
    `,
    },
  };

  const handleOpen = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const openLogoutConfirm = () => {
    handleClose();
    setConfirmLogout(true);
  };

  const handleConfirmLogout = async () => {
    setConfirmLogout(false);
    await logout();
  };

  return (
    <Box sx={{ position: "relative" }}>
      <AppBar
        position="fixed"
        sx={{
          boxShadow: "none",
          height: "64px",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Link href={brandHref} style={{ textDecoration: "none" }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ cursor: "pointer", width: { xs: 180, sm: "auto" } }}
            >
              <Typography
                variant="body1"
                color="text.primary"
                noWrap
                sx={{ display: { xs: "block", sm: "none" } }}
              >
                {isVisitorArea || isGateStaffArea ? t.navbarBrand : "Sentry Visitor Portal"}
              </Typography>

              <Typography
                variant="h6"
                fontWeight="bold"
                color="text.primary"
                noWrap
                sx={{ display: { xs: "none", sm: "block" } }}
              >
                {isVisitorArea || isGateStaffArea ? t.navbarBrand : "Sentry Visitor Portal"}
              </Typography>
            </Stack>
          </Link>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {(isVisitorArea || isGateStaffArea) && <LanguageSwitcher />}

            <Tooltip title={t[mode === "light" ? "navSwitchToDark" : "navSwitchToLight"]}>
              <IconButton
                onClick={toggleColorMode} 
                sx={{ 
                  color: "text.primary",
                  bgcolor: mode === 'light' ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
                  "&:hover": { bgcolor: mode === 'light' ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)" }
                }}
                size="small"
              >
                {mode === "light" ? <ICONS.dark fontSize="small" /> : <ICONS.light fontSize="small" />}
              </IconButton>
            </Tooltip>

            {user ? (
              <>
                <Tooltip title={t.navViewProfile}>
                  <IconButton onClick={handleOpen} sx={avatarButtonStyle}>
                    <Avatar
                      sx={{
                        bgcolor: "white",
                        width: 30,
                        height: 30,
                        color: "#033649",
                        fontWeight: "bold",
                        fontSize: "0.8rem",
                      }}
                    >
                      {user.full_name
                        ?.split(" ")
                        .map((n) => n[0]?.toUpperCase())
                        .slice(0, 2)
                        .join("")}
                    </Avatar>
                  </IconButton>
                </Tooltip>

                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                  PaperProps={{
                    elevation: 0,
                    sx: {
                      mt: 1,
                      borderRadius: 2,
                      minWidth: 200,
                      boxShadow: `
            2px 2px 6px rgba(0, 0, 0, 0.1),
            -2px -2px 6px rgba(255, 255, 255, 0.4)
          `,
                    },
                  }}
                >
                  <MenuItem>
                    <Typography variant="body2" color="text.secondary">
                      {t.navLoggedInAs}
                      <strong>
                        &nbsp;
                        {user.role?.charAt(0).toUpperCase() +
                          user.role?.slice(1)}
                      </strong>
                    </Typography>
                  </MenuItem>
                  <MenuItem>
                    <Typography variant="body2">{user.full_name}</Typography>
                  </MenuItem>

                  {["admin", "superadmin", "staff", "dev"].includes(user.role) && (
                    <MenuItem
                      onClick={() => {
                        handleClose();
                        if (user.role === "staff") {
                          router.push(getStaffDestination(user));
                        } else if (user.role === "dev") {
                          router.push("/cms/settings");
                        } else if (user.role === "admin" && user.adminType === "kitchen") {
                          router.push("/cms/kitchen");
                        } else {
                          router.push("/cms/dashboard");
                        }
                      }}
                    >
                      <ICONS.home fontSize="small" sx={{ mr: 1 }} />
                      {t.navGoToDashboard}
                    </MenuItem>
                  )}

                  <MenuItem
                    onClick={openLogoutConfirm}
                    sx={{ color: "error.main" }}
                  >
                    <ICONS.logout fontSize="small" sx={{ mr: 1 }} />
                    {t.navLogout}
                  </MenuItem>
                </Menu>
              </>
            ) : null}

          </Box>
        </Toolbar>
      </AppBar>

      <ConfirmationDialog
        open={!!user && confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleConfirmLogout}
        title={t.navConfirmLogoutTitle}
        message={t.navConfirmLogoutMessage}
        confirmButtonText={t.navLogout}
        confirmButtonIcon={<ICONS.logout fontSize="small" />}
      />
    </Box>
  );
}
