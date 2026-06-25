"use client";

import {
  Box,
  Typography,
  Button,
  Tooltip,
  Divider,
  FormControlLabel,
  Checkbox,
  Switch,
  Chip,
  CircularProgress,
  Stack,
  Paper,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme,
  Alert,
} from "@mui/material";
import { useEffect, useState, useCallback, useRef } from "react";
import PermissionRouteGuard from "@/components/auth/PermissionRouteGuard";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { canAccessResource } from "@/utils/permissions";
import ICONS from "@/utils/iconUtil";
import { getRolePagePermissions, setRolePagePermissions } from "@/services/permissionService";
import { refreshUser } from "@/services/authService";
import { ROLE_KEYS, getPagesForRole } from "@/constants/pageCatalog";
import { PAGE_ICONS } from "@/constants/pageIcons";

const ACTION_LABELS = {
  "vip-bypass": "VIP Fast Track",
};

function actionLabel(action) {
  return ACTION_LABELS[action] || action.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Render CRUD actions in logical order (Create, Read, Update, Delete);
// any non-CRUD actions keep their catalog order after them.
const ACTION_ORDER = { create: 0, read: 1, update: 2, delete: 3 };

function sortActions(actions) {
  return [...actions].sort(
    (a, b) => (ACTION_ORDER[a] ?? 99) - (ACTION_ORDER[b] ?? 99),
  );
}

function RoleItem({ roleKey, label, description, isActive, onClick, showChevron }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2,
        borderRadius: 2,
        cursor: "pointer",
        border: "1px solid",
        borderColor: isActive ? "primary.main" : "divider",
        bgcolor: isActive ? "primary.main" : "transparent",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        transition: "all 0.18s ease",
        "&:hover": {
          borderColor: "primary.main",
          bgcolor: isActive ? "primary.dark" : "action.hover",
        },
      }}
    >
      <ICONS.badge sx={{ color: isActive ? "primary.contrastText" : "text.secondary", fontSize: 20, flexShrink: 0 }} />
      <Box sx={{ flex: 1, overflow: "hidden" }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            color: isActive ? "primary.contrastText" : "text.primary",
            fontSize: "0.88rem",
            lineHeight: 1.3,
          }}
        >
          {label}
        </Typography>
        {description && (
          <Typography variant="caption" sx={{ color: isActive ? "primary.contrastText" : "text.secondary", opacity: isActive ? 0.8 : 1, display: "block" }}>
            {description}
          </Typography>
        )}
      </Box>
      {showChevron && (
        <ICONS.chevronRight sx={{ color: isActive ? "primary.contrastText" : "text.secondary", fontSize: 18, flexShrink: 0 }} />
      )}
    </Box>
  );
}

export default function AccessControlPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const isSuperAdmin = user?.role === "superadmin";
  const canUpdate = canAccessResource(user, "access-control", { hardcodeAllowed: isSuperAdmin, action: "update" });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [selectedRoleIdx, setSelectedRoleIdx] = useState(0);
  const selectedRole = ROLE_KEYS[selectedRoleIdx];
  const rolePages = getPagesForRole(selectedRole?.key);

  const [assignments, setAssignments] = useState({});
  const [savedAssignments, setSavedAssignments] = useState({});
  const [loadingRole, setLoadingRole] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mobileTab, setMobileTab] = useState(0);

  const loadRolePermissions = useCallback(async (roleKey) => {
    setLoadingRole(true);
    const data = await getRolePagePermissions(roleKey);
    const map = {};
    if (Array.isArray(data)) {
      for (const entry of data) {
        map[entry.pageId] = new Set(Array.isArray(entry.actions) ? entry.actions : []);
      }
    }
    setAssignments(map);
    setSavedAssignments(
      Object.fromEntries(Object.entries(map).map(([k, v]) => [k, new Set(v)]))
    );
    setLoadingRole(false);
  }, []);

  useEffect(() => {
    if (selectedRole) loadRolePermissions(selectedRole.key);
  }, [selectedRole, loadRolePermissions]);

  const selectedRoleKeyRef = useRef(selectedRole?.key);
  useEffect(() => { selectedRoleKeyRef.current = selectedRole?.key; }, [selectedRole]);

  useEffect(() => {
    if (!socket) return;
    const onRoleUpdated = ({ roleKey }) => {
      if (roleKey === selectedRoleKeyRef.current) {
        loadRolePermissions(roleKey);
      }
    };
    socket.on("page-permissions:role-updated", onRoleUpdated);
    return () => { socket.off("page-permissions:role-updated", onRoleUpdated); };
  }, [socket, loadRolePermissions]);

  function toggleAction(pageId, action) {
    setAssignments((prev) => {
      const current = new Set(prev[pageId] || []);
      if (current.has(action)) current.delete(action);
      else current.add(action);
      return { ...prev, [pageId]: current };
    });
  }

  function toggleAll(pageId, allChecked) {
    setAssignments((prev) => {
      const page = rolePages.find((p) => p.pageId === pageId);
      const pageActions = page ? page.actions : [];
      return { ...prev, [pageId]: allChecked ? new Set() : new Set(pageActions) };
    });
  }

  function isDirty() {
    for (const page of rolePages) {
      const curr = assignments[page.pageId] || new Set();
      const saved = savedAssignments[page.pageId] || new Set();
      if (curr.size !== saved.size) return true;
      for (const a of curr) if (!saved.has(a)) return true;
    }
    return false;
  }

  function handleReset() {
    setAssignments(
      Object.fromEntries(Object.entries(savedAssignments).map(([k, v]) => [k, new Set(v)]))
    );
  }

  async function handleSave() {
    setSaving(true);
    const entries = rolePages
      .map((page) => {
        const actions = [...(assignments[page.pageId] || new Set())];
        return actions.length > 0 ? { pageId: page.pageId, actions } : null;
      })
      .filter(Boolean);

    const result = await setRolePagePermissions(selectedRole.key, entries);
    if (!result?.error) {
      setSavedAssignments(
        Object.fromEntries(
          Object.entries(assignments).map(([k, v]) => [k, new Set(v)])
        )
      );
      const role = selectedRole.key.split(":")[0];
      const type = selectedRole.key.split(":")[1];
      if (user?.role === role && (user?.adminType === type || user?.staffType === type)) {
        refreshUser();
      }
    }
    setSaving(false);
  }

  // ── Role list panel ────────────────────────────────────────
  const roleListPanel = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {ROLE_KEYS.map((r, i) => (
        <RoleItem
          key={r.key}
          roleKey={r.key}
          label={r.label}
          description={r.description}
          isActive={i === selectedRoleIdx}
          showChevron={isMobile}
          onClick={() => {
            setSelectedRoleIdx(i);
            if (isMobile) setMobileTab(1);
          }}
        />
      ))}
    </Box>
  );

  // ── Permissions accordion panel ─────────────────────────────
  const accordionPanel = (
    <Box>
      {loadingRole ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Alert severity="info" sx={{ borderRadius: 2, fontSize: "0.82rem", mb: 2 }}>
            Actions checked here become the base set for <strong>{selectedRole.label}</strong>.
          </Alert>

          {canUpdate && (
            <Stack
              direction={{ xs: "column-reverse", sm: "row" }}
              alignItems={{ sm: "center" }}
              justifyContent={{ sm: "flex-end" }}
              gap={{ xs: 1.5, sm: 1 }}
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 5,
                bgcolor: "background.default",
                borderBottom: "1px solid",
                borderColor: "divider",
                py: 1.5,
                mb: 1.5,
              }}
            >
              <Button
                variant="outlined"
                disabled={saving || !isDirty()}
                onClick={handleReset}
                startIcon={<ICONS.refresh />}
                sx={{ borderRadius: 30, width: { xs: "100%", sm: "auto" } }}
              >
                Reset
              </Button>
              <Button
                variant="contained"
                disabled={saving || !isDirty()}
                onClick={handleSave}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <ICONS.save />}
                sx={{ borderRadius: 30, width: { xs: "100%", sm: "auto" } }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </Stack>
          )}

          {rolePages.length === 0 ? (
            <Alert severity="info">No page permissions configured for this role.</Alert>
          ) : rolePages.map((page) => {
            const granted = assignments[page.pageId] || new Set();
            const pageActions = sortActions(page.actions);
            const allChecked = pageActions.every((a) => granted.has(a));
            const someChecked = pageActions.some((a) => granted.has(a));
            const PageIcon = PAGE_ICONS[page.pageId];

            return (
              <Box
                key={page.pageId}
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 1,
                  rowGap: 0.5,
                  mb: 1,
                  px: { xs: 1.5, sm: 2 },
                  py: { xs: 1.25, sm: 1 },
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                }}
              >
                <Chip
                  label={page.label}
                  size="small"
                  icon={PageIcon ? <PageIcon sx={{ fontSize: "1rem !important" }} /> : undefined}
                  sx={{
                    order: 1,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    fontSize: "0.7rem",
                    borderRadius: 999,
                    minWidth: { sm: 150 },
                    justifyContent: "flex-start",
                  }}
                />

                <Stack
                  direction="row"
                  flexWrap="wrap"
                  alignItems="center"
                  sx={{
                    order: { xs: 3, sm: 2 },
                    flexBasis: { xs: "100%", sm: "auto" },
                    flexGrow: { sm: 1 },
                    columnGap: 0.5,
                  }}
                >
                  {pageActions.map((action) => (
                    <FormControlLabel
                      key={action}
                      control={
                        <Checkbox
                          checked={granted.has(action)}
                          onChange={() => canUpdate && toggleAction(page.pageId, action)}
                          disabled={!canUpdate}
                          size="small"
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: "0.85rem" }}>
                          {actionLabel(action)}
                        </Typography>
                      }
                      sx={{ mr: 1 }}
                    />
                  ))}
                </Stack>

                {canUpdate && (
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={0.5}
                    sx={{ order: { xs: 2, sm: 3 }, ml: "auto" }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {allChecked ? "Deselect all" : "Select all"}
                    </Typography>
                    <Tooltip title={allChecked ? "Deselect all actions" : "Select all actions"}>
                      <Switch
                        checked={allChecked}
                        size="small"
                        color={someChecked && !allChecked ? "warning" : "success"}
                        onClick={() => toggleAll(page.pageId, allChecked)}
                      />
                    </Tooltip>
                  </Stack>
                )}
              </Box>
            );
          })}

        </>
      )}
    </Box>
  );

  return (
    <PermissionRouteGuard resource="access-control" hardcodeAllowed={isSuperAdmin}>
      <Box>
        <Box sx={{ mt: 2, mb: 1 }}>
          <Typography variant="h5" fontWeight="bold">
            Access Control
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Assign page-level permissions to each role. All users of that role inherit this base set.
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {isMobile ? (
          <Box>
            <Box sx={{ position: "sticky", top: 0, zIndex: 10, bgcolor: "background.default", pb: 1 }}>
              <Tabs
                value={mobileTab}
                onChange={(_, v) => setMobileTab(v)}
                variant="fullWidth"
                sx={{
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  border: 1,
                  borderColor: "divider",
                  "& .MuiTab-root": { fontWeight: 600, textTransform: "none", fontSize: "0.88rem" },
                }}
              >
                <Tab label="Select Role" />
                <Tab
                  label={
                    mobileTab === 1 || selectedRoleIdx >= 0
                      ? `Permissions: ${ROLE_KEYS[selectedRoleIdx]?.label ?? ""}`
                      : "Permissions"
                  }
                />
              </Tabs>
            </Box>

            {mobileTab === 0 && (
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mt: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 0.5 }}>
                  Select Role
                </Typography>
                {roleListPanel}
              </Paper>
            )}

            {mobileTab === 1 && (
              <Box sx={{ mt: 1 }}>
                {accordionPanel}
              </Box>
            )}
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 3, alignItems: "start" }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2,
                position: "sticky",
                top: 80,
                maxHeight: "calc(100vh - 160px)",
                overflowY: "auto",
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 0.5 }}>
                Select Role
              </Typography>
              {roleListPanel}
            </Paper>

            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {selectedRole.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedRole.description}
                </Typography>
              </Stack>
              {accordionPanel}
            </Box>
          </Box>
        )}
      </Box>
    </PermissionRouteGuard>
  );
}
