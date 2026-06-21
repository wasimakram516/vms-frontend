"use client";

import {
  Box,
  Typography,
  Button,
  Avatar,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  MenuItem,
  CircularProgress,
  Divider,
  Pagination,
  FormControl,
  Select,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  Tabs,
  Tab,
  Checkbox,
  Alert,
} from "@mui/material";
import { useColorMode } from "@/contexts/ThemeContext";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import ICONS from "@/utils/iconUtil";
import LoadingState from "@/components/LoadingState";
import {
  getAllUsers,
  updateUser,
  deleteUser,
  createStaffUser,
  createAdminUser,
  createSuperAdminUser,
  assignUserDepartments,
} from "@/services/userService";
import { getDepartments } from "@/services/departmentService";
import { listPermissions, getRolePermissions, getUserOverrides, setUserOverrides } from "@/services/permissionService";
import AppCard from "@/components/cards/AppCard";
import ConfirmationDialog from "@/components/modals/ConfirmationDialog";
import DialogHeader from "@/components/modals/DialogHeader";
import ListToolbar from "@/components/ListToolbar";
import NoDataAvailable from "@/components/NoDataAvailable";
import ResponsiveCardGrid from "@/components/ResponsiveCardGrid";
import { validateField, validatePhone } from "@/utils/validationUtils";
import RecordMetadata from "@/components/RecordMetadata";
import PermissionRouteGuard from "@/components/auth/PermissionRouteGuard";
import { canAccessResource } from "@/utils/permissions";
import CountryCodeSelector from "@/components/CountryCodeSelector";
import { DEFAULT_ISO_CODE, getCountryAndPhoneByFullPhone, getCountryCodeByIsoCode, formatPhoneNumberForDisplay } from "@/utils/countryCodes";
import { filterPhoneInput, onKeyPressPhone } from "@/utils/phoneUtils";

const CREATABLE_ROLES = ["superadmin", "admin", "staff"];
const STAFF_TYPES = ["gate", "kitchen"];
const ADMIN_TYPES = ["departmental", "kitchen"];

// Guard: only strip bare dial digits when the code is ≥2 chars to avoid false-stripping single-digit codes (+1, +7).
const stripDialPrefix = (phone, isoCode) => {
  if (!phone) return "";
  const country = getCountryCodeByIsoCode(isoCode);
  if (!country) return phone;
  const dialWithPlus = country.code; // e.g. "+968"
  const dialDigits = dialWithPlus.replace(/^\+/, ""); // e.g. "968"
  if (phone.startsWith(dialWithPlus)) return phone.slice(dialWithPlus.length);
  if (dialDigits.length >= 2 && phone.startsWith(dialDigits)) return phone.slice(dialDigits.length);
  return phone;
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { socket } = useSocket();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const isSuperAdmin = currentUser?.role === "superadmin";
  const canCreate = canAccessResource(currentUser, "users", { hardcodeAllowed: isSuperAdmin, action: "create" });
  const canUpdate = canAccessResource(currentUser, "users", { hardcodeAllowed: isSuperAdmin, action: "update" });
  const canDelete = canAccessResource(currentUser, "users", { hardcodeAllowed: isSuperAdmin, action: "delete" });
  const canReadOverrides = canAccessResource(currentUser, "access-control", { hardcodeAllowed: currentUser?.role === "superadmin" || currentUser?.role === "dev", action: "read" });
  const canManageOverrides = canAccessResource(currentUser, "access-control", { hardcodeAllowed: currentUser?.role === "superadmin" || currentUser?.role === "dev", action: "update" });

  const [users, setUsers] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const isEditingSelf = isEditMode && selectedUserId === currentUser?.id;
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [staffTypeFilter, setStaffTypeFilter] = useState("all");
  const [adminTypeFilter, setAdminTypeFilter] = useState("all");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [userStatusTarget, setUserStatusTarget] = useState(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  const defaultForm = {
    full_name: "",
    email: "",
    password: "",
    role: "staff",
    staff_type: "gate",
    department_ids: [],
    phone: "",
    adminType: "departmental",
  };

  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [isoCodes, setIsoCodes] = useState({ phone: DEFAULT_ISO_CODE });

  // Permission override tab state
  const [modalTab, setModalTab] = useState(0);
  const [allPermissions, setAllPermissions] = useState([]);
  const [overrides, setOverrides] = useState({});       // create form: { [permId]: { [action]: "allow"|"deny"|"" } }
  const [editOverrides, setEditOverrides] = useState({}); // edit form
  const [rolePermissions, setRolePermissions] = useState({}); // create form base grants: { [permId]: string[] }
  const [editRolePermissions, setEditRolePermissions] = useState({}); // edit form base grants

  const PERM_ACTIONS = ["read", "create", "update", "delete"];

  function getFormRoleKey(role, staff_type, adminType) {
    if (role === "admin") return `admin:${adminType || "departmental"}`;
    if (role === "staff") return `staff:${staff_type || "gate"}`;
    return null;
  }

  function handleToggleOverride(permId, action, isInherited, isEditing) {
    const setter = isEditing ? setEditOverrides : setOverrides;
    setter((prev) => {
      const current = prev[permId]?.[action] || "";
      const next = isInherited
        ? (current === "deny" ? "" : "deny")
        : (current === "allow" ? "" : "allow");
      return { ...prev, [permId]: { ...(prev[permId] || {}), [action]: next } };
    });
  }

  function buildOverridesPayload(state) {
    return Object.entries(state)
      .map(([permissionId, actions]) => ({
        permissionId,
        overrides: Object.entries(actions)
          .filter(([, effect]) => effect === "allow" || effect === "deny")
          .map(([action, effect]) => ({ action, effect })),
      }))
      .filter((item) => item.overrides.length > 0);
  }

  useEffect(() => {
    fetchUsers();
    getDepartments().then((res) => {
      if (Array.isArray(res)) setAllDepartments(res);
    });
    if (canReadOverrides || canManageOverrides) {
      listPermissions().then((data) => {
        if (Array.isArray(data)) setAllPermissions(data);
      });
    }
  }, []);

  // Load base role permissions whenever the create form's role/type changes
  useEffect(() => {
    if (isEditMode) return;
    const roleKey = getFormRoleKey(form.role, form.staff_type, form.adminType);
    if (!roleKey) { setRolePermissions({}); return; }
    getRolePermissions(roleKey).then((data) => {
      const map = {};
      if (Array.isArray(data)) {
        for (const entry of data) {
          map[entry.permissionId] = Array.isArray(entry.actions) ? entry.actions : [];
        }
      }
      setRolePermissions(map);
    });
  }, [form.role, form.staff_type, form.adminType, isEditMode]);

  // Live-sync permission data via socket events emitted by the backend after any permission write
  useEffect(() => {
    if (!socket) return;

    // Permission record created/updated/deleted — refresh the accordion list in the dialog
    const onResourcesUpdated = () => {
      listPermissions().then((data) => { if (Array.isArray(data)) setAllPermissions(data); });
    };

    // Role's base grants changed — refresh if the open dialog is editing a user with that role-key
    const onRoleUpdated = ({ roleKey }) => {
      if (!isEditMode || !selectedUserId) return;
      const openRoleKey = getFormRoleKey(form.role, form.staff_type, form.adminType);
      if (openRoleKey !== roleKey) return;
      getRolePermissions(roleKey).then((data) => {
        const map = {};
        if (Array.isArray(data)) {
          for (const entry of data) map[entry.permissionId] = Array.isArray(entry.actions) ? entry.actions : [];
        }
        setEditRolePermissions(map);
      });
    };

    // A specific user's overrides changed — refresh if that user's dialog is open
    const onUserUpdated = ({ userId }) => {
      if (!isEditMode || selectedUserId !== userId) return;
      getUserOverrides(userId).then((data) => {
        if (!Array.isArray(data)) return;
        const loaded = {};
        data.forEach((item) => {
          loaded[item.permissionId] = (item.overrides || []).reduce((acc, ov) => {
            acc[ov.action] = ov.effect;
            return acc;
          }, {});
        });
        setEditOverrides(loaded);
      });
    };

    socket.on("permissions:resources-updated", onResourcesUpdated);
    socket.on("permissions:role-updated", onRoleUpdated);
    socket.on("permissions:user-updated", onUserUpdated);

    return () => {
      socket.off("permissions:resources-updated", onResourcesUpdated);
      socket.off("permissions:role-updated", onRoleUpdated);
      socket.off("permissions:user-updated", onUserUpdated);
    };
  }, [socket, isEditMode, selectedUserId, form.role, form.staff_type, form.adminType]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setForm(defaultForm);
    setErrors({});
    setIsoCodes({ phone: DEFAULT_ISO_CODE });
    setIsEditMode(false);
    setSelectedUserId(null);
    setOverrides({});
    setRolePermissions({});
    setModalTab(0);
    setModalOpen(true);
  };

  const handleOpenEdit = (u) => {
    setForm({
      full_name: u.full_name || "",
      email: u.email || "",
      password: "",
      role: u.role || "staff",
      staff_type: u.staff_type || "",
      department_ids: Array.isArray(u.departments) ? u.departments.map((d) => d.id) : [],
      adminType: u.adminType || "departmental",
    });
    
    if (u.role === "visitor") {
      const isoCode = u.iso_code || DEFAULT_ISO_CODE;
      setForm((p) => ({ ...p, phone: stripDialPrefix(u.phone || "", isoCode) }));
      setIsoCodes({ phone: isoCode });
    } else {
      const { isoCode, phone: digits } = getCountryAndPhoneByFullPhone(u.phone);
      setForm((p) => ({ ...p, phone: digits }));
      setIsoCodes({ phone: isoCode });
    }
    setErrors({});
    setIsEditMode(true);
    setSelectedUserId(u.id);
    setEditOverrides({});
    setEditRolePermissions({});
    setModalTab(0);
    setModalOpen(true);

    // Load role base permissions
    const roleKey = getFormRoleKey(u.role, u.staff_type || "", u.adminType || "departmental");
    if (roleKey) {
      getRolePermissions(roleKey).then((data) => {
        const map = {};
        if (Array.isArray(data)) {
          for (const entry of data) {
            map[entry.permissionId] = Array.isArray(entry.actions) ? entry.actions : [];
          }
        }
        setEditRolePermissions(map);
      });
    }

    // Load existing user overrides
    getUserOverrides(u.id).then((data) => {
      if (Array.isArray(data)) {
        const loaded = {};
        data.forEach((item) => {
          loaded[item.permissionId] = (item.overrides || []).reduce((acc, ov) => {
            acc[ov.action] = ov.effect;
            return acc;
          }, {});
        });
        setEditOverrides(loaded);
      }
    });
  };

  const validateForm = () => {
    const newErrors = {};

    const fullNameError = validateField({ label: "Full Name", required: true }, form.full_name);
    if (fullNameError) newErrors.full_name = fullNameError;

    const emailError = validateField({ label: "Email", required: true, inputType: "email" }, form.email);
    if (emailError) newErrors.email = emailError;

    if (!isEditMode) {
      const passwordError = validateField({ label: "Password", required: true }, form.password);
      if (passwordError) newErrors.password = passwordError;
    }

    if (form.role === "staff") {
      const staffTypeError = validateField({ label: "Staff Type", required: true }, form.staff_type);
      if (staffTypeError) newErrors.staff_type = staffTypeError;
    }

    const phoneError = validatePhone(form.phone, isoCodes.phone);
    if (phoneError) newErrors.phone = phoneError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleSave = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        phoneIsoCode: isoCodes.phone,
      };
      let res;
      if (isEditMode) {
        res = await updateUser(selectedUserId, payload);
      } else {
        res =
          form.role === "superadmin"
            ? await createSuperAdminUser(payload)
            : form.role === "admin"
              ? await createAdminUser(payload)
              : await createStaffUser(payload);
      }

      if (!res?.error) {
        const savedId = isEditMode ? selectedUserId : res?.id;
        if (form.role === "admin" && savedId) {
          await assignUserDepartments(savedId, form.department_ids);
        }
        // Save permission overrides only when user has update access on access-control
        if (savedId && canManageOverrides) {
          const overridesToSave = isEditMode ? editOverrides : overrides;
          const overridesPayload = buildOverridesPayload(overridesToSave);
          if (isEditMode || overridesPayload.length > 0) {
            await setUserOverrides(savedId, overridesPayload);
          }
        }
        setModalTab(0);
        setModalOpen(false);
        fetchUsers();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (u) => {
    setUserToDelete(u);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(userToDelete.id);
      fetchUsers();
    } finally {
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    }
  };

  const handleStatusClick = (u) => {
    setUserStatusTarget(u);
    setStatusConfirmOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!userStatusTarget) return;
    const currentStatus = String(userStatusTarget.status || "active").toLowerCase();
    const nextStatus = currentStatus === "active" ? "inactive" : "active";

    try {
      await updateUser(userStatusTarget.id, { status: nextStatus });
      fetchUsers();
    } finally {
      setStatusConfirmOpen(false);
      setUserStatusTarget(null);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];
    const filtered = users.filter((u) => {
      if (u.role === "dev") return false;
      const matchSearch =
        (u.full_name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStaffType =
        roleFilter !== "staff" || 
        staffTypeFilter === "all" || 
        (u.staff_type && u.staff_type === staffTypeFilter);
      const matchAdminType =
        roleFilter !== "admin" ||
        adminTypeFilter === "all" ||
        (u.adminType && u.adminType === adminTypeFilter) ||
        (!u.adminType && adminTypeFilter === "departmental"); // fallback for old records
      return matchSearch && matchRole && matchStaffType && matchAdminType;
    });

    // Sort by role order: superadmin, admin, staff, visitor
    const roleOrder = { superadmin: 0, admin: 1, staff: 2, visitor: 3 };
    return filtered.sort((a, b) => {
      let aOrder = roleOrder[a.role] ?? 4;
      let bOrder = roleOrder[b.role] ?? 4;
      
      // For admin, sort by adminType: departmental first, then kitchen
      if (a.role === "admin" && b.role === "admin") {
        const adminOrder = { departmental: 0, kitchen: 1 };
        aOrder = 1 + (adminOrder[a.adminType || "departmental"] ?? 2);
        bOrder = 1 + (adminOrder[b.adminType || "departmental"] ?? 2);
      }

      // For staff, sort by staff_type: gate first, then kitchen
      if (a.role === "staff" && b.role === "staff") {
        const staffOrder = { gate: 0, kitchen: 1 };
        aOrder = 2 + (staffOrder[a.staff_type] ?? 2);
        bOrder = 2 + (staffOrder[b.staff_type] ?? 2);
      }
      
      return aOrder - bOrder;
    });
  }, [users, searchQuery, roleFilter, staffTypeFilter, adminTypeFilter]);

  const pagedUsers = useMemo(() => {
    return filteredUsers.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage,
    );
  }, [filteredUsers, page, rowsPerPage]);

  const pagedGroupedUsers = useMemo(() => {
    const groups = {
      superadmin: [],
      admin_departmental: [],
      admin_kitchen: [],
      staff_gate: [],
      staff_kitchen: [],
      staff_unassigned: [],
      visitor: [],
    };

    pagedUsers.forEach((u) => {
      if (u.role === "superadmin") {
        groups.superadmin.push(u);
      } else if (u.role === "admin") {
        if (u.adminType === "kitchen") {
          groups.admin_kitchen.push(u);
        } else {
          groups.admin_departmental.push(u);
        }
      } else if (u.role === "staff") {
        if (u.staff_type === "gate") {
          groups.staff_gate.push(u);
        } else if (u.staff_type === "kitchen") {
          groups.staff_kitchen.push(u);
        } else {
          groups.staff_unassigned.push(u);
        }
      } else {
        groups.visitor.push(u);
      }
    });

    return groups;
  }, [pagedUsers]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "superadmin":
        return "error";
      case "admin_departmental":
      case "admin_kitchen":
      case "admin":
        return "primary";
      case "staff":
      case "staff_gate":
      case "staff_kitchen":
        return "secondary";
      case "visitor":
        return "success";
      default:
        return "default";
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PermissionRouteGuard resource="users" hardcodeAllowed={isSuperAdmin}>
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
            User Management
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, opacity: 0.8 }}
          >
            Manage organizational users and system access roles.
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1,
            width: { xs: "100%", sm: "auto" },
          }}
        >
          {canCreate && (
            <Button
              variant="contained"
              startIcon={<ICONS.add />}
              onClick={handleOpenCreate}
            >
              Create
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <ListToolbar
        showingCount={pagedUsers.length}
        totalCount={filteredUsers.length}
        searchSlot={
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: (
                <ICONS.search fontSize="small" sx={{ mr: 1, opacity: 0.6 }} />
              ),
            }}
            sx={{ maxWidth: { md: 380 } }}
          />
        }
        actionsSlot={
          <>
            <TextField
              select
              label="Role"
              size="small"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                if (e.target.value !== "staff") setStaffTypeFilter("all");
                if (e.target.value !== "admin") setAdminTypeFilter("all");
                setPage(0);
              }}
              sx={{ minWidth: { xs: "100%", sm: 160 } }}
            >
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="superadmin">SuperAdmin</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="staff">Staff</MenuItem>
              <MenuItem value="visitor">Visitor</MenuItem>
            </TextField>
            {roleFilter === "staff" && (
              <TextField
                select
                label="Staff Type"
                size="small"
                value={staffTypeFilter}
                onChange={(e) => {
                  setStaffTypeFilter(e.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: { xs: "100%", sm: 160 } }}
              >
                <MenuItem value="all">All Types</MenuItem>
                {STAFF_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {roleFilter === "admin" && (
              <TextField
                select
                label="Admin Type"
                size="small"
                value={adminTypeFilter}
                onChange={(e) => {
                  setAdminTypeFilter(e.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: { xs: "100%", sm: 160 } }}
              >
                <MenuItem value="all">All Types</MenuItem>
                {ADMIN_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <FormControl
              size="small"
              sx={{ minWidth: { xs: "100%", sm: 160 } }}
            >
              <InputLabel>Records per page</InputLabel>
              <Select
                value={rowsPerPage}
                onChange={handleChangeRowsPerPage}
                label="Records per page"
              >
                {[6, 12, 24, 48].map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        }
      />

      {filteredUsers.length === 0 ? (
        <NoDataAvailable
          title="No users found"
          description="Try adjusting your filters or search query."
        />
      ) : (
        <>
          {["superadmin", "admin_departmental", "admin_kitchen", "staff_gate", "staff_kitchen", "staff_unassigned", "visitor"].map((role) => {
            const roleUsers = pagedGroupedUsers[role];
            if (!roleUsers || roleUsers.length === 0) return null;

            const roleLabels = {
              superadmin: "Super Admins",
              admin_departmental: "Departmental Admins",
              admin_kitchen: "Kitchen Admins",
              staff_gate: "Gate Staff",
              staff_kitchen: "Kitchen Staff",
              staff_unassigned: "Unassigned Staff",
              visitor: "Visitors",
            };

        return (
          <Accordion
            key={role}
            defaultExpanded={role !== "visitor"}
            sx={{
              mb: 3,
              borderRadius: "12px !important",
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              "&::before": { display: "none" },
              bgcolor: isDark ? "rgba(255,255,255,0.02)" : "#fff",
            }}
          >
            <AccordionSummary
              expandIcon={<ICONS.down />}
              sx={{
                bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Typography variant="h6" fontWeight={800}>
                  {roleLabels[role]}
                </Typography>
                <Chip
                  label={roleUsers.length}
                  size="small"
                  color={getRoleColor(role)}
                  sx={{ fontWeight: 800 }}
                />
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 3, bgcolor: "transparent" }}>
              <ResponsiveCardGrid gap={{ xs: 3, md: 3.5 }}>
                {roleUsers.map((u) => (
                  <AppCard
                    key={u.id}
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      width: "100%",
                    }}
                  >
                    {/* Header: Exact match to registrations */}
                    <Box
                      sx={{
                        background: isDark
                          ? "linear-gradient(to right, rgba(255,255,255,0.05), rgba(255,255,255,0.08))"
                          : "linear-gradient(to right, #f5f5f5, #fafafa)",
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        p: 2,
                      }}
                    >
                      <Stack spacing={0.25}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ gap: 1 }}
                        >
                          <Stack direction="row" alignItems="center" sx={{ minWidth: 0, flex: 1, gap: 1 }}>
                            <Avatar
                              sx={{
                                width: 40,
                                height: 40,
                                bgcolor: isDark ? "#fff" : "#000",
                                color: isDark ? "#000" : "#fff",
                                fontSize: "1rem",
                                fontWeight: 800,
                              }}
                            >
                              {u.full_name
                                ?.split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("") || "?"}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography
                                variant="subtitle1"
                                fontWeight={800}
                                noWrap
                                sx={{ lineHeight: 1.2 }}
                              >
                                {u.full_name}
                              </Typography>
                            </Box>
                          </Stack>

                          <Chip
                            label={String(u.status || "active").toLowerCase() === "active" ? "Active" : "Inactive"}
                            size="small"
                            color={String(u.status || "active").toLowerCase() === "active" ? "success" : "default"}
                            variant={String(u.status || "active").toLowerCase() === "active" ? "filled" : "outlined"}
                            sx={{ fontWeight: 800 }}
                          />
                        </Stack>
                      </Stack>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.6}
                        sx={{ mt: 1 }}
                      >
                        <Chip
                          label={u.role.toUpperCase()}
                          size="small"
                          color={getRoleColor(u.role)}
                          icon={
                            <ICONS.person sx={{ fontSize: "12px !important" }} />
                          }
                          sx={{ fontWeight: 800, borderRadius: 1.5, height: 24 }}
                        />
                        {u.role === "staff" && u.staff_type && (
                          <Chip
                            label={u.staff_type.toUpperCase()}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 800, borderRadius: 1.5, height: 24 }}
                          />
                        )}
                        {u.role === "admin" && (
                          <Chip
                            label={(u.adminType || "departmental").toUpperCase()}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 800, borderRadius: 1.5, height: 24 }}
                          />
                        )}
                      </Stack>
                    </Box>

                    {/* Body: Email row */}
                    <Box sx={{ flexGrow: 1, px: 2, py: 1.5 }}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          py: 0.8,
                          borderBottom:
                            (u.role === "staff" && u.staff_type) ||
                            (u.role === "admin" && (u.adminType || u.departments?.length > 0))
                              ? "1px solid"
                              : "none",
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.6,
                            color: "text.secondary",
                          }}
                        >
                          <ICONS.emailOutline
                            fontSize="small"
                            sx={{ opacity: 0.6 }}
                          />{" "}
                          Email
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            ml: 2,
                            flex: 1,
                            textAlign: "right",
                            color: "text.primary",
                          }}
                        >
                          {u.email}
                        </Typography>
                      </Box>

                      {u.phone && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            py: 0.8,
                          borderBottom:
                            (u.role === "staff" && u.staff_type) ||
                            (u.role === "admin" && (u.adminType || u.departments?.length > 0))
                              ? "1px solid"
                              : "none",
                          borderColor: "divider",
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.6,
                              color: "text.secondary",
                              fontWeight: 500,
                            }}
                          >
                            <ICONS.phone
                              fontSize="small"
                              sx={{ opacity: 0.8, color: "primary.main" }}
                            />{" "}
                            Phone
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              ml: 2,
                              flex: 1,
                              textAlign: "right",
                              color: "text.primary",
                              dir: "ltr",
                            }}
                          >
                            {formatPhoneNumberForDisplay(u.phone, u.iso_code)}
                          </Typography>
                        </Box>
                      )}

                      {u.role === "staff" && u.staff_type && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            py: 0.8,
                            borderBottom: "none",
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.6,
                              color: "text.secondary",
                            }}
                          >
                            <ICONS.business
                              fontSize="small"
                              sx={{ opacity: 0.6 }}
                            />{" "}
                            Staff Type
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              ml: 2,
                              flex: 1,
                              textAlign: "right",
                              color: "text.primary",
                              textTransform: "capitalize",
                            }}
                          >
                            {u.staff_type}
                          </Typography>
                        </Box>
                      )}

                      {u.role === "admin" && u.departments?.length > 0 && (
                        <Box sx={{ py: 0.8, borderBottom: "none" }}>
                          <Typography
                            variant="body2"
                            sx={{ display: "flex", alignItems: "center", gap: 0.6, color: "text.secondary", mb: 0.5 }}
                          >
                            <ICONS.apartment fontSize="small" sx={{ opacity: 0.6 }} />{" "}
                            Departments
                          </Typography>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                            {u.departments.map((d) => (
                              <Chip key={d.id} label={d.name} size="small" variant="outlined" sx={{ fontSize: "0.7rem" }} />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>

                    <Box
                      sx={{
                        p: 1.2,
                        borderTop: "1px solid",
                        borderColor: "divider",
                        bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1
                      }}
                    >
                      <Box sx={{ width: "100%", overflow: "hidden" }}>
                        <RecordMetadata
                          createdByName={u.created_by}
                          updatedByName={u.updated_by}
                          createdAt={u.created_at}
                          updatedAt={u.updated_at}
                          locale="en-GB"
                          sx={{ px: 0, py: 0 }}
                        />
                      </Box>
                      {(canUpdate || canDelete) && (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {canUpdate && (
                          <Tooltip title="Edit User">
                            <IconButton
                              color="primary"
                              onClick={() => handleOpenEdit(u)}
                              size="small"
                              sx={{
                                bgcolor: isDark
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(0,0,0,0.03)",
                              }}
                            >
                              <ICONS.edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          )}
                          {canUpdate && u.id !== currentUser.id && (
                            <Tooltip title={String(u.status || "active").toLowerCase() === "active" ? "Deactivate User" : "Activate User"}>
                              <IconButton
                                color={String(u.status || "active").toLowerCase() === "active" ? "warning" : "success"}
                                onClick={() => handleStatusClick(u)}
                                size="small"
                                sx={{
                                  bgcolor: isDark
                                    ? "rgba(255,255,255,0.05)"
                                    : "rgba(0,0,0,0.03)",
                                }}
                              >
                                {String(u.status || "active").toLowerCase() === "active" ? <ICONS.close fontSize="small" /> : <ICONS.check fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          )}
                          {canDelete && u.id !== currentUser.id && (
                            <Tooltip title="Delete User">
                              <IconButton
                                color="error"
                                onClick={() => handleDeleteClick(u)}
                                size="small"
                                sx={{
                                  bgcolor: isDark
                                    ? "rgba(255,100,100,0.05)"
                                    : "rgba(255,0,0,0.03)",
                                }}
                              >
                                <ICONS.delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      )}
                    </Box>
                  </AppCard>
                ))}
              </ResponsiveCardGrid>
            </AccordionDetails>
          </Accordion>
        );
      })}
        </>
      )}

      <Box display="flex" justifyContent="center" mt={4}>
        {filteredUsers.length > rowsPerPage && (
          <Pagination
            count={Math.ceil(filteredUsers.length / rowsPerPage)}
            page={page + 1}
            onChange={(e, v) => setPage(v - 1)}
            color="primary"
          />
        )}
      </Box>

      <Dialog
        open={modalOpen}
        onClose={() => { if (!submitting) { setModalOpen(false); setModalTab(0); } }}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { variant: "frosted", borderRadius: 4 } }}
      >
        <DialogHeader
          title={isEditMode ? "Edit User" : "Create New User"}
          onClose={!submitting ? () => { setModalOpen(false); setModalTab(0); } : undefined}
        />
        <DialogContent dividers sx={{ p: 0 }}>
          {/* Sticky tabs — hidden for superadmin/visitor (no overrides apply), or when user lacks override permission or is editing self */}
          {form.role !== "superadmin" && form.role !== "visitor" && (canReadOverrides || canManageOverrides) && !isEditingSelf && (
            <Box sx={{ position: "sticky", top: 0, zIndex: 10, bgcolor: "background.paper", px: 2, pt: 2, pb: 1, borderBottom: "1px solid", borderColor: "divider" }}>
              <Tabs
                value={modalTab}
                onChange={(_, v) => setModalTab(v)}
                variant="fullWidth"
                sx={{
                  borderRadius: 2,
                  bgcolor: "action.hover",
                  minHeight: 40,
                  "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 700, fontSize: "0.875rem" },
                }}
              >
                <Tab label="Details" />
                <Tab label="Permissions" />
              </Tabs>
            </Box>
          )}

          {/* Tab 0: Details */}
          <Box sx={{ display: (form.role === "superadmin" || form.role === "visitor" || modalTab === 0) ? "flex" : "none", flexDirection: "column", gap: 2, p: 2.5 }}>
            <TextField
              label="Full Name"
              fullWidth
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              error={!!errors.full_name}
              helperText={errors.full_name}
              autoComplete="name"
            />
            <TextField
              label="Email"
              fullWidth
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={!!errors.email}
              helperText={errors.email}
              autoComplete="email"
            />
            <TextField
              label={isEditMode ? "New Password (optional)" : "Password"}
              type="password"
              fullWidth
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={!!errors.password}
              helperText={errors.password}
              autoComplete="new-password"
              sx={{ display: form.role === "visitor" ? "none" : "flex" }}
            />
            <TextField
              fullWidth
              label="Phone"
              value={form.phone}
              error={Boolean(errors.phone)}
              helperText={errors.phone}
              onChange={(e) => {
                setForm((p) => ({ ...p, phone: filterPhoneInput(e.target.value) }));
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: null }));
              }}
              onKeyPress={onKeyPressPhone}
              InputProps={{
                startAdornment: (
                  <CountryCodeSelector
                    value={isoCodes.phone}
                    onChange={(iso) => {
                      setIsoCodes((p) => ({ ...p, phone: iso }));
                      if (form.phone) {
                        const err = validatePhone(form.phone, iso);
                        setErrors((p) => ({ ...p, phone: err }));
                      }
                    }}
                  />
                ),
              }}
            />
            <TextField
              select
              label="Role"
              fullWidth
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              disabled={isEditMode && form.role === "visitor"}
            >
              {CREATABLE_ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </MenuItem>
              ))}
              {!CREATABLE_ROLES.includes(form.role) && (
                <MenuItem value={form.role} disabled>
                  {form.role.charAt(0).toUpperCase() + form.role.slice(1)}
                </MenuItem>
              )}
            </TextField>

            {form.role === "staff" && (
              <TextField
                select
                label="Staff Type"
                fullWidth
                value={form.staff_type}
                onChange={(e) => setForm({ ...form, staff_type: e.target.value })}
                error={!!errors.staff_type}
                helperText={errors.staff_type}
              >
                {STAFF_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>
                ))}
              </TextField>
            )}

            {form.role === "admin" && (
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1, fontSize: "0.85rem" }}>Admin Type</FormLabel>
                <RadioGroup
                  row
                  value={form.adminType}
                  onChange={(e) => setForm({ ...form, adminType: e.target.value })}
                >
                  <FormControlLabel value="departmental" control={<Radio size="small" />} label={<Typography variant="body2">Departmental</Typography>} />
                  <FormControlLabel value="kitchen" control={<Radio size="small" />} label={<Typography variant="body2">Kitchen</Typography>} />
                </RadioGroup>
              </FormControl>
            )}

            {form.role === "admin" && form.adminType === "departmental" && (
              <FormControl fullWidth>
                <InputLabel>Departments</InputLabel>
                <Select
                  multiple
                  value={form.department_ids}
                  onChange={(e) => setForm({ ...form, department_ids: e.target.value })}
                  label="Departments"
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selected.map((id) => {
                        const dept = allDepartments.find((d) => d.id === id);
                        return dept ? <Chip key={id} label={dept.name} size="small" /> : null;
                      })}
                    </Box>
                  )}
                >
                  {allDepartments.map((dept) => (
                    <MenuItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>

          {/* Tab 1: Permission Overrides — shown when user has read or manage permission, not editing self, and role supports it */}
          <Box sx={{ display: form.role !== "superadmin" && form.role !== "visitor" && (canReadOverrides || canManageOverrides) && modalTab === 1 ? "flex" : "none", flexDirection: "column", gap: 1.5, p: 2.5 }}>
            {isEditingSelf ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                You cannot modify your own permission overrides.
              </Alert>
            ) : form.role === "superadmin" ? (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                SuperAdmins bypass all permission checks — overrides have no effect for this role.
              </Alert>
            ) : allPermissions.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                No permissions have been defined yet. Create permissions in Access Control first.
              </Alert>
            ) : (
              <>
                <Alert severity="info" sx={{ borderRadius: 2, fontSize: "0.82rem" }}>
                  Checked actions are granted. Overrides layer on top of the role&apos;s base set — <strong>deny</strong> removes an inherited action, <strong>allow</strong> adds one the role doesn&apos;t have.
                </Alert>
                {allPermissions.map((perm) => {
                  const baseGrants = isEditMode ? (editRolePermissions[perm.id] || []) : (rolePermissions[perm.id] || []);
                  const currentOverrides = isEditMode ? editOverrides : overrides;
                  return (
                    <Accordion
                      key={perm.id}
                      variant="outlined"
                      disableGutters
                      sx={{ borderRadius: "8px !important", "&:before": { display: "none" }, overflow: "hidden" }}
                    >
                      <AccordionSummary expandIcon={<ICONS.expandMore />}>
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", textTransform: "uppercase" }}>{perm.resource}</Typography>
                          {perm.description && (
                            <Typography variant="caption" color="text.secondary">{perm.description}</Typography>
                          )}
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ bgcolor: "action.hover", borderTop: "1px solid", borderColor: "divider", p: 1.5 }}>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 1 }}>
                          {PERM_ACTIONS.map((action) => {
                            const isInherited = baseGrants.includes(action);
                            const currentOverride = currentOverrides[perm.id]?.[action] || "";
                            const isChecked = isInherited ? currentOverride !== "deny" : currentOverride === "allow";
                            const isOverridden = currentOverride !== "";
                            return (
                              <Box
                                key={action}
                                onClick={() => canManageOverrides && handleToggleOverride(perm.id, action, isInherited, isEditMode)}
                                sx={{
                                  p: 1,
                                  borderRadius: 1.5,
                                  border: "1px solid",
                                  borderColor: isChecked ? "primary.main" : "divider",
                                  bgcolor: isChecked ? "action.selected" : "background.paper",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: 0.5,
                                  cursor: canManageOverrides ? "pointer" : "default",
                                  transition: "all 0.15s ease",
                                  "&:hover": canManageOverrides ? { borderColor: "primary.main", bgcolor: "action.hover" } : {},
                                }}
                              >
                                <Checkbox
                                  checked={isChecked}
                                  size="small"
                                  sx={{ p: 0 }}
                                  disabled={!canManageOverrides}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => canManageOverrides && handleToggleOverride(perm.id, action, isInherited, isEditMode)}
                                />
                                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "capitalize", lineHeight: 1 }}>
                                  {action}
                                </Typography>
                                {isOverridden ? (
                                  <Chip
                                    label={currentOverride}
                                    size="small"
                                    color={currentOverride === "allow" ? "success" : "error"}
                                    sx={{ height: 16, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.75 } }}
                                  />
                                ) : isInherited ? (
                                  <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "text.secondary", lineHeight: 1 }}>
                                    inherited
                                  </Typography>
                                ) : null}
                              </Box>
                            );
                          })}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => { setModalOpen(false); setModalTab(0); }}
            disabled={submitting}
            startIcon={<ICONS.cancel />}
            sx={{ borderRadius: 30 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={submitting}
            startIcon={
              submitting ? (
                <CircularProgress size={20} />
              ) : isEditMode ? (
                <ICONS.save />
              ) : (
                <ICONS.add />
              )
            }
            sx={{ borderRadius: 30 }}
          >
            {submitting
              ? "Saving..."
              : isEditMode
                ? "Update"
                : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.full_name}? This action cannot be undone.`}
        confirmButtonText="Delete"
        confirmButtonIcon={<ICONS.delete fontSize="small" />}
      />

      <ConfirmationDialog
        open={statusConfirmOpen}
        onClose={() => setStatusConfirmOpen(false)}
        onConfirm={handleConfirmStatusChange}
        title={String(userStatusTarget?.status || "active").toLowerCase() === "active" ? "Deactivate User" : "Activate User"}
        message={
          String(userStatusTarget?.status || "active").toLowerCase() === "active"
            ? `Are you sure you want to deactivate ${userStatusTarget?.full_name}?`
            : `Are you sure you want to activate ${userStatusTarget?.full_name}?`
        }
        confirmButtonText={String(userStatusTarget?.status || "active").toLowerCase() === "active" ? "Deactivate" : "Activate"}
        confirmButtonIcon={String(userStatusTarget?.status || "active").toLowerCase() === "active" ? <ICONS.close fontSize="small" /> : <ICONS.check fontSize="small" />}
      />
    </Box>
    </PermissionRouteGuard>
  );
}
