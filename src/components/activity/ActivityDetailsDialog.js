"use client";

import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import ICONS from "@/utils/iconUtil";
import { getActivityDisplayLabel } from "@/utils/activityMeta";
import { parseUserAgent } from "@/utils/userAgent";
import DialogHeader from "@/components/modals/DialogHeader";

const AUTH_ACTIVITY_TYPES = new Set(["login", "logout"]);

/** Make loopback addresses explicit during local development. */
const formatIpAddress = (ipAddress) => {
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    return `${ipAddress} (IPv6 localhost)`;
  }
  return ipAddress;
};

/** Explain why geographic data may not exist for a captured address. */
const formatLocation = (location, ipAddress) => {
  if (location) return location;
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    return "Local machine";
  }
  return "Not resolved (GeoIP lookup is not configured)";
};

/** Convert a stored auth reason code into readable text. */
const formatReason = (reason) => {
  const labels = {
    invalid_credentials: "Invalid credentials",
    account_deactivated: "Account deactivated",
  };
  return labels[reason] ?? reason ?? null;
};

/** Render one labelled, wrapping value in the details dialog. */
function DetailField({ label, value, monospace = false, fullWidth = false }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <Box
      component="div"
      sx={{
        minWidth: 0,
        py: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        gridColumn: fullWidth ? "1 / -1" : "auto",
      }}
    >
      <Typography
        component="dt"
        variant="overline"
        color="text.secondary"
        sx={{ display: "block", fontSize: "0.62rem", lineHeight: 1.5 }}
      >
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        sx={{
          mt: 0.25,
          mx: 0,
          fontWeight: 650,
          overflowWrap: "anywhere",
          fontFamily: monospace ? "monospace" : "inherit",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/** Show the reviewed, non-secret details for one activity event. */
export default function ActivityDetailsDialog({
  activity,
  open,
  onClose,
  detailLines = [],
}) {
  const metadata = activity?.metadata ?? {};
  const isAuthenticationEvent = AUTH_ACTIVITY_TYPES.has(activity?.activityType);
  const result = metadata.result;
  const client = parseUserAgent(metadata.userAgent);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-label="Activity details"
      PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
    >
      <DialogHeader title="Activity Details" onClose={onClose} />
      <Divider />
      <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Stack spacing={2.5}>
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "action.hover",
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2.5,
                  display: "grid",
                  placeItems: "center",
                  color: "text.primary",
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <ICONS.history sx={{ fontSize: 22 }} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={800}>
                  {getActivityDisplayLabel(activity?.activityType, metadata)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Audit log event
                </Typography>
              </Box>
              {result ? (
                <Chip
                  size="small"
                  label={result === "success" ? "Successful" : "Failed"}
                  color={result === "success" ? "success" : "error"}
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
              ) : null}
            </Stack>
          </Box>

          <Box
            component="dl"
            sx={{
              m: 0,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              columnGap: 3,
              "& > div:last-of-type": {
                borderBottom: 0,
              },
            }}
          >
            <DetailField
              label={isAuthenticationEvent ? "Account" : "Subject"}
              value={activity?.visitorName ?? "Not available"}
            />
            <DetailField label="Performed by" value={activity?.actorName} />
            <DetailField
              label="Date and time"
              value={
                activity?.createdAt
                  ? dayjs(activity.createdAt).format("DD MMM YYYY, hh:mm:ss A")
                  : null
              }
            />

            {isAuthenticationEvent ? (
              <>
                <DetailField label="Role" value={metadata.accountRole} />
                <DetailField
                  label="Source IP address"
                  value={formatIpAddress(metadata.ipAddress)}
                  monospace
                />
                <DetailField
                  label="Approximate location"
                  value={formatLocation(metadata.location, metadata.ipAddress)}
                />
                <DetailField label="Browser" value={client.browser} />
                <DetailField
                  label="Operating system"
                  value={client.operatingSystem}
                />
                <DetailField label="Device type" value={client.device} />
                <DetailField
                  label="Failure reason"
                  value={formatReason(metadata.reason)}
                />
                <DetailField
                  label="Application request ID"
                  value={metadata.requestId}
                  monospace
                />
                <DetailField
                  label="Raw user agent"
                  value={metadata.userAgent}
                  fullWidth
                />
              </>
            ) : (
              detailLines.map(({ label, value }) => (
                <DetailField key={label} label={label} value={value} />
              ))
            )}

            <DetailField
              label="Description"
              value={activity?.notes}
              fullWidth
            />
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
