"use client";

import { Box, Stack, Typography, Tooltip } from "@mui/material";
import { formatDateTimeWithLocale } from "@/utils/dateUtils";
import ICONS from "@/utils/iconUtil";

const iconSx = { fontSize: "0.9rem", flexShrink: 0, opacity: 0.7 };
const rowSx = {
  display: "flex",
  alignItems: "center",
  flexWrap: "nowrap",
  gap: 0.5,
  overflow: "hidden",
  whiteSpace: "nowrap",
};

function RecordMetadata({
  createdByName,
  updatedByName,
  createdAt,
  updatedAt,
  locale = "en-GB",
  updatedAtFallback,
  createdByDisplayName,
  updatedByDisplayName,
  sx = {},
}) {
  const normalizeName = (val) => {
    if (!val) return null;
    if (typeof val === "object") return val.name || val.fullName || val.email || null;
    return val;
  };
  const resolvedCreatedByName =
    normalizeName(createdByName) || (createdByDisplayName && String(createdByDisplayName).trim()) || "N/A";
  const rawUpdatedByName =
    normalizeName(updatedByName) || (updatedByDisplayName && String(updatedByDisplayName).trim()) || "N/A";
  const dateStr = (d) => (d ? formatDateTimeWithLocale(d, locale) : "—");
  const updatedAtDisplay = updatedAt ?? updatedAtFallback;
  const eitherUpdatedNA = !updatedAtDisplay || rawUpdatedByName === "N/A";
  const updatedByNameDisplay = eitherUpdatedNA ? "Never updated" : rawUpdatedByName;
  const updatedAtForDisplay = eitherUpdatedNA ? undefined : updatedAtDisplay;

  const createdByLabel = "Created";
  const updatedByLabel = "Updated";

  const PersonIcon = ICONS.person ?? ICONS.personOutline;
  const TimeIcon = ICONS.time ?? ICONS.timeOutline;
  const CreatedIcon = ICONS.add ?? ICONS.history ?? ICONS.timeOutline;
  const UpdatedIcon = ICONS.update ?? ICONS.sync ?? ICONS.timeOutline;

  return (
    <Box
      sx={{
        px: 1,
        py: 0.6,
        bgcolor: "transparent",
        borderRadius: 1.5,
        ...sx,
      }}
    >
      <Stack spacing={0.35}>
        <Tooltip title={createdByLabel} arrow>
          <Box sx={rowSx} component="span">
            {CreatedIcon && <CreatedIcon sx={{ ...iconSx, color: "success.main" }} />}
            {PersonIcon && <PersonIcon sx={{ ...iconSx, color: "success.main" }} />}
            <Typography
              variant="caption"
              sx={{ fontSize: "0.65rem", color: "text.secondary" }}
              noWrap
            >
            {resolvedCreatedByName}
            </Typography>
            <Box
              component="span"
              sx={{
                width: 3,
                height: 3,
                borderRadius: "50%",
                bgcolor: "text.disabled",
                opacity: 0.7,
              }}
            />
            {TimeIcon && <TimeIcon sx={{ ...iconSx, color: "success.main" }} />}
            <Typography
              variant="caption"
              sx={{ fontSize: "0.65rem", color: "text.secondary" }}
              noWrap
            >
              {dateStr(createdAt)}
            </Typography>
          </Box>
        </Tooltip>
        <Tooltip title={updatedByLabel} arrow>
          <Box sx={rowSx} component="span">
            {UpdatedIcon && <UpdatedIcon sx={{ ...iconSx, color: "info.main" }} />}
            {PersonIcon && <PersonIcon sx={{ ...iconSx, color: "info.main" }} />}
            <Typography
              variant="caption"
              sx={{ fontSize: "0.65rem", color: "text.secondary" }}
              noWrap
            >
              {updatedByNameDisplay}
            </Typography>
            {!eitherUpdatedNA && (
              <>
                <Box
                  component="span"
                  sx={{
                    width: 3,
                    height: 3,
                    borderRadius: "50%",
                    bgcolor: "text.disabled",
                    opacity: 0.7,
                  }}
                />
                {TimeIcon && <TimeIcon sx={{ ...iconSx, color: "info.main" }} />}
                <Typography
                  variant="caption"
                  sx={{ fontSize: "0.65rem", color: "text.secondary" }}
                  noWrap
                >
                  {dateStr(updatedAtForDisplay)}
                </Typography>
              </>
            )}
          </Box>
        </Tooltip>
      </Stack>
    </Box>
  );
}

export default RecordMetadata;
