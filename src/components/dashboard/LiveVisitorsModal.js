"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Stack,
  Chip,
  Avatar,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SignalCellularAltIcon from "@mui/icons-material/SignalCellularAlt";
import ApartmentIcon from "@mui/icons-material/Apartment";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { useColorMode } from "@/contexts/ThemeContext";

// Derives two letter initials from a full name
function getInitials(name = "") {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic muted color per name so each visitor avatar has a consistent color
const AVATAR_COLORS = [
  "#5C6BC0", "#26A69A", "#8D6E63", "#546E7A",
  "#7E57C2", "#42A5F5", "#66BB6A", "#FFA726",
];
function avatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function VisitorRow({ visitor, isDark }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        py: 1,
        px: 1.5,
        borderRadius: 2,
        "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" },
      }}
    >
      <Box sx={{ position: "relative", flexShrink: 0 }}>
        <Avatar
          sx={{
            width: 36,
            height: 36,
            fontSize: "0.75rem",
            fontWeight: 700,
            bgcolor: avatarColor(visitor.fullName),
            color: "#fff",
          }}
        >
          {getInitials(visitor.fullName)}
        </Avatar>
        {/* Green online dot */}
        <Box
          sx={{
            position: "absolute",
            bottom: 1,
            right: 1,
            width: 9,
            height: 9,
            bgcolor: "#4CAF50",
            borderRadius: "50%",
            border: "1.5px solid",
            borderColor: isDark ? "#1a1a2e" : "#fff",
          }}
        />
      </Box>

      <Box flex={1} minWidth={0}>
        <Typography variant="body2" fontWeight={700} noWrap>
          {visitor.fullName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Active now
        </Typography>
      </Box>

      <SignalCellularAltIcon sx={{ fontSize: 18, color: "#4CAF50" }} />
    </Stack>
  );
}

// Placeholder empty slot row
function EmptySlot({ isDark }) {
  return (
    <Box
      sx={{
        py: 1,
        px: 1.5,
        borderRadius: 2,
        border: "1.5px dashed",
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
        textAlign: "center",
        mt: 1.5,
      }}
    >
      <Typography variant="caption" color="text.disabled">
        — no further users —
      </Typography>
    </Box>
  );
}

function GroupCard({ group, isDark, groupBy }) {
  const VISIBLE_SLOTS = 3;
  const isScrollable = group.visitors.length > VISIBLE_SLOTS;
  // Fill empty slots so the card always shows exactly VISIBLE_SLOTS rows
  const emptyCount = isScrollable ? 0 : Math.max(0, VISIBLE_SLOTS - group.visitors.length);
  const GroupIcon = groupBy === "accessLevel" ? VpnKeyIcon : ApartmentIcon;

  // Height of one row (py:1 = 8px top+bottom, avatar 36px + gap) ≈ 60px per row
  const ROW_HEIGHT = 60;

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
        borderRadius: 3,
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
      }}
    >
      {/* Group header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              p: 0.75,
              borderRadius: 1.5,
              bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GroupIcon sx={{ fontSize: 15, color: "text.secondary" }} />
          </Box>
          <Typography variant="body2" fontWeight={700}>
            {group.name}
          </Typography>
        </Stack>
        <Chip
          label={`${group.count} ${group.count === 1 ? "user" : "users"}`}
          size="small"
          sx={{
            height: 20,
            fontSize: "0.68rem",
            fontWeight: 700,
            bgcolor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)",
            color: "text.secondary",
            border: "none",
          }}
        />
      </Stack>

      <Divider sx={{ opacity: 0.5, my: 0.5 }} />

      {/* Scrollable user list — fixed height shows exactly 3 rows */}
      <Box
        sx={{
          height: ROW_HEIGHT * VISIBLE_SLOTS,
          overflowY: isScrollable ? "auto" : "hidden",
          // Thin scrollbar
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
            borderRadius: 2,
          },
        }}
      >
        {group.visitors.map((v) => (
          <VisitorRow key={v.id} visitor={v} isDark={isDark} />
        ))}

        {/* Empty placeholder slots to pad up to 3 rows */}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <EmptySlot key={`empty-${i}`} isDark={isDark} />
        ))}
      </Box>
    </Box>
  );
}

export default function LiveVisitorsModal({ open, onClose, data }) {
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const [groupBy, setGroupBy] = useState("department");

  if (!data) return null;

  const groups = groupBy === "accessLevel" ? data.byAccessLevel : data.byDepartment;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          bgcolor: isDark ? "#0f1117" : "#fff",
          backgroundImage: "none",
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
          maxHeight: "85vh",
        },
      }}
    >
      {/* Title bar */}
      <DialogTitle sx={{ pb: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="h6" fontWeight={700}>
              Live Visitors
            </Typography>
            <Chip
              label={`${data.total} checked in`}
              size="small"
              sx={{
                bgcolor: "#4CAF50",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.72rem",
                height: 22,
                "& .MuiChip-label": { px: 1 },
              }}
            />
          </Stack>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* Summary chips per group */}
        <Stack direction="row" flexWrap="wrap" gap={1} mt={1.5} mb={1}>
          {groups.map((g) => (
            <Chip
              key={g.id ?? g.name}
              label={`${g.name} · ${g.count}`}
              size="small"
              sx={{
                fontWeight: 600,
                fontSize: "0.72rem",
                bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                color: "text.primary",
                border: "none",
              }}
            />
          ))}
        </Stack>

        {/* Toggle */}
        <ToggleButtonGroup
          value={groupBy}
          exclusive
          onChange={(_, val) => val && setGroupBy(val)}
          size="small"
          sx={{ mb: 1 }}
        >
          <ToggleButton value="department" sx={{ px: 2, fontWeight: 700, fontSize: "0.75rem", borderRadius: "8px 0 0 8px" }}>
            <ApartmentIcon sx={{ fontSize: 14, mr: 0.5 }} />
            By Department
          </ToggleButton>
          <ToggleButton value="accessLevel" sx={{ px: 2, fontWeight: 700, fontSize: "0.75rem", borderRadius: "0 8px 8px 0" }}>
            <VpnKeyIcon sx={{ fontSize: 14, mr: 0.5 }} />
            By Access Level
          </ToggleButton>
        </ToggleButtonGroup>
      </DialogTitle>

      <Divider sx={{ opacity: 0.5 }} />

      {/* Group cards grid */}
      <DialogContent sx={{ pt: 2 }}>
        {groups.length === 0 ? (
          <Box py={6} textAlign="center">
            <Typography color="text.secondary">No visitors currently checked in.</Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            {groups.map((group) => (
              <GroupCard key={group.id ?? group.name} group={group} isDark={isDark} groupBy={groupBy} />
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
