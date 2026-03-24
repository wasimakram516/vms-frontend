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
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useColorMode } from "@/contexts/ThemeContext";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";

import ICONS from "@/utils/iconUtil";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { mode, toggleColorMode } = useColorMode();

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
          <Link href="/" style={{ textDecoration: "none" }}>
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
                                {"Sinan VMS"}
              </Typography>

              <Typography
                variant="h6"
                fontWeight="bold"
                color="text.primary"
                noWrap
                sx={{ display: { xs: "none", sm: "block" } }}
              >
                                {"Sinan VMS"}
              </Typography>
            </Stack>
          </Link>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
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

            {!user ? (
              <Link href="/auth/login">
                <Tooltip title="Sign In">
                  <IconButton color="primary" sx={avatarButtonStyle}>
                    <ICONS.login fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Link>
            ) : (
              <>
                <Tooltip title="View profile">
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
                      logged in as  
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

                  <MenuItem
                    onClick={openLogoutConfirm}
                    sx={{ color: "error.main" }}
                  >
                    <ICONS.logout fontSize="small" sx={{ mr: 1 }} />
                    Logout
                  </MenuItem>
                </Menu>
              </>
            )}

          </Box>
        </Toolbar>
      </AppBar>

      <ConfirmationDialog
        open={!!user && confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleConfirmLogout}
        title="Confirm Logout"
        message="Are you sure you want to log out of your account?"
        confirmButtonText="Logout"
        confirmButtonIcon={<ICONS.logout fontSize="small" />}
      />
    </Box>
  );
}
