"use client";

import {
  Box,
  Typography,
  Button,
  Tooltip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
import NoDataAvailable from "@/components/NoDataAvailable";
import { canAccessResource } from "@/utils/permissions";
import ICONS from "@/utils/iconUtil";
import {
  listPermissions,
  getRolePermissions,
  setRolePermissions,
} from "@/services/permissionService";
import { refreshUser } from "@/services/authService";

const ROLE_KEYS = [
  { key: "admin:departmental", label: "Departmental Admin", description: "Admin managing department-level visits" },
  { key: "admin:kitchen", label: "Kitchen Admin", description: "Admin managing kitchen orders" },
  { key: "staff:gate", label: "Gate Staff", description: "Staff handling gate check-in/out" },
  { key: "staff:kitchen", label: "Kitchen Staff", description: "Staff preparing kitchen orders" },
];

const ACTIONS = ["read", "create", "update", "delete"];

// ── Role list item ────────────────────────────────────────────────────────────
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
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
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

export default function RolePermissionsPage() {
  const { user, setUser } = useAuth();
  const { socket } = useSocket();
  const isSuperAdmin = user?.role === "superadmin";
  const canUpdate = canAccessResource(user, "access-control", { hardcodeAllowed: user?.role === "superadmin" || user?.role === "dev", action: "update" });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [permissions, setPermissions] = useState([]);
  const [loadingPerms, setLoadingPerms] = useState(true);

  const [selectedRoleIdx, setSelectedRoleIdx] = useState(0);
  const selectedRole = ROLE_KEYS[selectedRoleIdx];

  // assignments: { [permissionId]: Set<action> }
  const [assignments, setAssignments] = useState({});
  const [savedAssignments, setSavedAssignments] = useState({});
  const [loadingRole, setLoadingRole] = useState(false);
  const [saving, setSaving] = useState(false);

  // Mobile: 0 = Select Role tab, 1 = Permissions tab
  const [mobileTab, setMobileTab] = useState(0);

  useEffect(() => {
    (async () => {
      setLoadingPerms(true);
      const data = await listPermissions();
      if (!data?.error) setPermissions(Array.isArray(data) ? data : []);
      setLoadingPerms(false);
    })();
  }, []);

  const loadRolePermissions = useCallback(async (roleKey) => {
    setLoadingRole(true);
    const data = await getRolePermissions(roleKey);
    const map = {};
    if (Array.isArray(data)) {
      for (const entry of data) {
        map[entry.permissionId] = new Set(Array.isArray(entry.actions) ? entry.actions : []);
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

  // Keep a stable ref to the active role key so socket handlers don't go stale
  const selectedRoleKeyRef = useRef(selectedRole?.key);
  useEffect(() => { selectedRoleKeyRef.current = selectedRole?.key; }, [selectedRole]);

  // Live-sync via permission socket events
  useEffect(() => {
    if (!socket) return;

    // Permission record added/edited/deleted — refresh the full list and reload current role
    const onResourcesUpdated = () => {
      listPermissions().then((data) => {
        if (!data?.error) setPermissions(Array.isArray(data) ? data : []);
      });
      if (selectedRoleKeyRef.current) loadRolePermissions(selectedRoleKeyRef.current);
    };

    // A role's grants were saved — reload if it's the one we're viewing
    const onRoleUpdated = ({ roleKey }) => {
      if (roleKey === selectedRoleKeyRef.current) {
        loadRolePermissions(roleKey);
      }
    };

    socket.on("permissions:resources-updated", onResourcesUpdated);
    socket.on("permissions:role-updated", onRoleUpdated);

    return () => {
      socket.off("permissions:resources-updated", onResourcesUpdated);
      socket.off("permissions:role-updated", onRoleUpdated);
    };
  }, [socket, loadRolePermissions]);

  function toggleAction(permId, action) {
    setAssignments((prev) => {
      const current = new Set(prev[permId] || []);
      if (current.has(action)) current.delete(action);
      else current.add(action);
      return { ...prev, [permId]: current };
    });
  }

  function toggleAll(permId, allChecked) {
    setAssignments((prev) => ({
      ...prev,
      [permId]: allChecked ? new Set() : new Set(ACTIONS),
    }));
  }

  function isDirty() {
    for (const perm of permissions) {
      const curr = assignments[perm.id] || new Set();
      const saved = savedAssignments[perm.id] || new Set();
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
    const payload = permissions
      .map((perm) => {
        const actions = [...(assignments[perm.id] || new Set())];
        return actions.length > 0 ? { permissionId: perm.id, actions } : null;
      })
      .filter(Boolean);

    const result = await setRolePermissions(selectedRole.key, payload);
    if (!result?.error) {
      setSavedAssignments(
        Object.fromEntries(
          Object.entries(assignments).map(([k, v]) => [k, new Set(v)])
        )
      );
      // Re-fetch user permissions so UI reflects changes immediately
      refreshUser().then((fresh) => { if (fresh) setUser(fresh); });
    }
    setSaving(false);
  }

  // ── Role list panel ───────────────────────────────────────────────────────
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

  // ── Permissions accordion panel ───────────────────────────────────────────
  const accordionPanel = (
    <Box>
      {loadingRole ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : permissions.length === 0 ? (
        <NoDataAvailable
          title="No permissions defined"
          description="Create at least one permission in the Permissions section before assigning roles."
        />
      ) : (
        <>
          <Alert severity="info" sx={{ borderRadius: 2, fontSize: "0.82rem", mb: 2 }}>
            Actions checked here become the base set for <strong>{selectedRole.label}</strong>.
          </Alert>

          {permissions.map((perm) => {
            const granted = assignments[perm.id] || new Set();
            const allChecked = ACTIONS.every((a) => granted.has(a));
            const someChecked = ACTIONS.some((a) => granted.has(a));

            return (
              <Accordion
                key={perm.id}
                variant="outlined"
                disableGutters
                sx={{ mb: 1, borderRadius: "8px !important", "&:before": { display: "none" }, overflow: "hidden" }}
              >
                <AccordionSummary expandIcon={<ICONS.expandMore />}>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, mr: 1 }}>
                    <Chip
                      label={perm.resource}
                      size="small"
                      sx={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.7rem", borderRadius: 999 }}
                    />
                    {perm.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                        {perm.description}
                      </Typography>
                    )}
                  </Stack>
                  {canUpdate && (
                    <Tooltip title={allChecked ? "Deselect all actions" : "Select all actions"}>
                      <Switch
                        checked={allChecked}
                        size="small"
                        color={someChecked && !allChecked ? "warning" : "primary"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAll(perm.id, allChecked);
                        }}
                        sx={{ mr: 0.5 }}
                      />
                    </Tooltip>
                  )}
                </AccordionSummary>
                <AccordionDetails sx={{ bgcolor: "action.hover", borderTop: "1px solid", borderColor: "divider", py: 1.5 }}>
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {ACTIONS.map((action) => (
                      <FormControlLabel
                        key={action}
                        control={
                          <Checkbox
                            checked={granted.has(action)}
                            onChange={() => canUpdate && toggleAction(perm.id, action)}
                            disabled={!canUpdate}
                            size="small"
                          />
                        }
                        label={
                          <Typography sx={{ fontSize: "0.85rem", textTransform: "capitalize" }}>
                            {action}
                          </Typography>
                        }
                        sx={{ mr: 1 }}
                      />
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            );
          })}

          {canUpdate && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent={{ sm: "flex-end" }}
            spacing={2}
            sx={{ mt: 3 }}
          >
            <Button
              variant="outlined"
              disabled={saving || !isDirty()}
              onClick={handleReset}
              startIcon={<ICONS.refresh />}
              sx={{ borderRadius: 30, width: { xs: "100%", sm: "auto" }, order: { xs: 2, sm: 1 } }}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              disabled={saving || !isDirty()}
              onClick={handleSave}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <ICONS.save />}
              sx={{ borderRadius: 30, width: { xs: "100%", sm: "auto" }, order: { xs: 1, sm: 2 } }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </Stack>
          )}
        </>
      )}
    </Box>
  );

  return (
    <PermissionRouteGuard resource="access-control" hardcodeAllowed={isSuperAdmin}>
      <Box>
        <Box sx={{ mt: 2, mb: 1 }}>
          <Typography variant="h5" fontWeight="bold">
            Role Permissions
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Assign a base permission set to each role type. All users of a role inherit this set.
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {loadingPerms ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : isMobile ? (
          // ── Mobile: two tabs ──────────────────────────────────────────────────
          <Box>
            <Box sx={{ position: "sticky", top: 0, zIndex: 10, bgcolor: "background.default", pb: 1 }}>
              <Tabs
                value={mobileTab}
                onChange={(_, v) => setMobileTab(v)}
                variant="fullWidth"
                sx={{
                  borderRadius: 2,
                  bgcolor: "action.hover",
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

            {/* Tab 0: Role list */}
            {mobileTab === 0 && (
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mt: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 0.5 }}>
                  Select Role
                </Typography>
                {roleListPanel}
              </Paper>
            )}

            {/* Tab 1: Permissions */}
            {mobileTab === 1 && (
              <Box sx={{ mt: 1 }}>
                {accordionPanel}
              </Box>
            )}
          </Box>
        ) : (
          // ── Desktop: sticky left panel + right panel ──────────────────────────
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
              <Typography
                variant="subtitle2"
                fontWeight={700}
                color="text.secondary"
                sx={{ mb: 1.5, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 0.5 }}
              >
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
