"use client";

import { useState, useEffect } from "react";
import dayjs from "dayjs";
import {
  Box,
  Typography,
  Chip,
  Stack,
  Button,
  Divider,
  CircularProgress,
  Collapse,
  alpha,
} from "@mui/material";
import ICONS from "@/utils/iconUtil";
import NoDataAvailable from "@/components/NoDataAvailable";
import { getKitchenOrdersForRegistration as getKitchenOrders } from "@/services/kitchenService";
import { formatDate, formatDateTimeWithLocale } from "@/utils/dateUtils";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "warning",
    icon: <ICONS.time fontSize="small" />,
  },
  admin_approved: {
    label: "Dept. Approved",
    color: "info",
    icon: <ICONS.checkCircleOutline fontSize="small" />,
  },
  approved: {
    label: "Approved",
    color: "success",
    icon: <ICONS.checkCircle fontSize="small" />,
  },
  rejected: {
    label: "Rejected",
    color: "error",
    icon: <ICONS.close fontSize="small" />,
  },
  checked_in: {
    label: "Checked In",
    color: "info",
    icon: <ICONS.login fontSize="small" />,
  },
  checked_out: {
    label: "Checked Out",
    color: "default",
    icon: <ICONS.logout fontSize="small" />,
  },
  cancelled: {
    label: "Cancelled",
    color: "default",
    icon: <ICONS.cancel fontSize="small" />,
  },
  visit_ended: {
    label: "Visit Ended",
    color: "default",
    icon: <ICONS.stop fontSize="small" />,
  },
  expired: {
    label: "Expired",
    color: "default",
    icon: <ICONS.history fontSize="small" />,
  },
  status_override: {
    label: "Status Override",
    color: "warning",
    icon: <ICONS.errorOutline fontSize="small" />,
  },
};

function toTitleCase(str) {
  if (!str) return "";
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildScheduleText(fromStr, toStr, emptyLabel = "Not scheduled yet") {
  if (!fromStr && !toStr) return emptyLabel;
  const f = fromStr ? formatDate(fromStr) : null;
  const t = toStr ? formatDate(toStr) : null;
  return f && t && f !== t ? `${f} to ${t}` : f || t || emptyLabel;
}

function getVisibleFieldValues(registration) {
  const raw = registration?.fieldValues || registration?.field_values || [];
  const map = {};
  const nk = (s = "") => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (Array.isArray(raw)) {
    raw.forEach((fv) => {
      const key = fv.customField?.fieldKey || fv.custom_field?.field_key;
      if (!key) return;
      const k = nk(key);
      const l = nk(fv.customField?.label);
      if (
        k.includes("purposeofvisit") ||
        k === "purpose" ||
        l.includes("purposeofvisit") ||
        l === "purpose"
      )
        return;
      if (
        k.includes("pleasespecify") ||
        k.includes("otherspecify") ||
        k.includes("otherpurpose") ||
        l.includes("pleasespecify") ||
        (l.includes("other") && l.includes("specify"))
      )
        return;
      if (
        k === "other" ||
        k.includes("otherdetails") ||
        l === "other" ||
        l.includes("otherdetails")
      )
        return;
      map[key] = fv.value;
    });
  }
  return map;
}

function InfoItem({ label, value, icon, sx = {} }) {
  return (
    <Box sx={sx}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Box
          sx={{
            color: "primary.main",
            display: "flex",
            alignItems: "center",
            minWidth: 22,
            opacity: 0.8,
          }}
        >
          {icon}
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontWeight: 700,
            textTransform: "uppercase",
            fontSize: "0.65rem",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Typography>
      </Stack>
      <Box sx={{ pl: "30px" }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontSize: "0.85rem",
            color: "text.primary",
            lineHeight: 1.4,
          }}
        >
          {value || "—"}
        </Typography>
      </Box>
    </Box>
  );
}

export default function HistoryVisitCard({
  visit,
  visitorName,
  isDark,
  onViewTimeline,
  onOpenMember,
}) {
  const visitFieldValues = getVisibleFieldValues(visit);
  const sc = STATUS_CONFIG[visit.status] || {
    label: toTitleCase(visit.status),
    color: "default",
    icon: <ICONS.history fontSize="small" />,
  };
  const isGroupMeeting =
    Array.isArray(visit.participants) && visit.participants.length > 1;
  const departmentName =
    typeof visit.department === "object" && visit.department
      ? visit.department.name
      : visit.department || "";
  const accessLevelName =
    (Array.isArray(visit.accessLevels) && visit.accessLevels.length
      ? visit.accessLevels.map((a) => a.name).join(", ")
      : typeof visit.accessLevel === "object" && visit.accessLevel
        ? visit.accessLevel.name
        : visit.accessLevel) ||
    "";
  const allowMultiCheckin = visit.allowMultiCheckin ?? false;
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState(new Set());

  useEffect(() => {
    if (showOrders && orders.length === 0) {
      setOrdersLoading(true);
      getKitchenOrders(visit.id)
        .then((res) => setOrders(Array.isArray(res) ? res : []))
        .catch(() => {})
        .finally(() => setOrdersLoading(false));
    }
  }, [showOrders, visit.id]);

  return (
    <Box
      sx={{
        p: 2.25,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? "rgba(255,255,255,0.02)"
            : "rgba(0,0,0,0.015)",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={800}>
            {visit.requestedFrom ? formatDate(visit.requestedFrom) : "Visit"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Submitted {formatDateTimeWithLocale(visit.createdAt)}
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ flexWrap: "wrap", rowGap: 1 }}
        >
          {isGroupMeeting && (
            <Chip
              label="Group Meeting"
              color="secondary"
              size="small"
              icon={<ICONS.group fontSize="small" />}
              sx={{ fontWeight: 700, borderRadius: 2, height: 26 }}
            />
          )}
          <Chip
            label={sc.label}
            color={sc.color}
            size="small"
            icon={sc.icon}
            sx={{ fontWeight: 700, borderRadius: 2, height: 26 }}
          />
        </Stack>
      </Stack>

      {isGroupMeeting && (
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontWeight: 800,
              textTransform: "uppercase",
              fontSize: "0.62rem",
              mb: 0.5,
              display: "block",
            }}
          >
            Members ({visit.participants.length})
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            flexWrap="wrap"
            useFlexGap
            sx={{ rowGap: 0.75 }}
          >
            {visit.participants.map((member) => (
              <Chip
                key={member.id}
                label={member.fullName}
                size="small"
                variant="outlined"
                clickable
                icon={<ICONS.person fontSize="small" />}
                onClick={() => onOpenMember?.(member)}
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Stack>
        </Box>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: { xs: 1.75, md: "16px 32px" },
        }}
      >
        <InfoItem
          label="Visiting Department"
          value={departmentName || "-"}
          icon={<ICONS.apartment fontSize="small" />}
        />
        <InfoItem
          label="Requested Schedule"
          value={buildScheduleText(
            visit.requestedFrom,
            visit.requestedTo,
            "Not provided",
          )}
          icon={<ICONS.event fontSize="small" />}
        />
        <InfoItem
          label="Approved Schedule"
          value={buildScheduleText(
            visit.approvedFrom,
            visit.approvedTo,
            "Not approved",
          )}
          icon={<ICONS.checkCircle fontSize="small" />}
        />
        <InfoItem
          label="Multi Check-in"
          value={allowMultiCheckin ? "Allowed" : "Not Allowed"}
          icon={<ICONS.replay fontSize="small" />}
        />
        <InfoItem
          label="Access Level"
          value={accessLevelName || "-"}
          icon={<ICONS.key fontSize="small" />}
        />
        {visit.rejectionReason ? (
          <InfoItem
            label="Rejection Reason"
            value={visit.rejectionReason}
            icon={<ICONS.close fontSize="small" />}
            sx={{ gridColumn: { md: "1 / -1" } }}
          />
        ) : null}
        {visit.approvalNote ? (
          <InfoItem
            label="Approver Note"
            value={visit.approvalNote}
            icon={<ICONS.info fontSize="small" />}
            sx={{ gridColumn: { md: "1 / -1" } }}
          />
        ) : null}
      </Box>

      {Object.keys(visitFieldValues).length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: { xs: 1.5, md: "16px 32px" },
            }}
          >
            {Object.entries(visitFieldValues).map(([key, val]) => (
              <Box
                key={key}
                sx={{
                  p: 1.75,
                  borderRadius: 2.5,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: isDark
                    ? "rgba(255,255,255,0.01)"
                    : "rgba(0,0,0,0.01)",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontWeight: 800,
                    textTransform: "uppercase",
                    fontSize: "0.6rem",
                  }}
                >
                  {key}
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ mt: 0.4 }}>
                  {String(val ?? "—")}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ mt: 2.5 }}
      >
        <Button
          variant="outlined"
          size="small"
          startIcon={<ICONS.list fontSize="small" />}
          onClick={() => onViewTimeline(visit.id, visitorName)}
          sx={{ borderRadius: 30, textTransform: "none", fontWeight: 700 }}
        >
          Activity Timeline
        </Button>
        <Button
          variant="outlined"
          size="small"
          color="secondary"
          startIcon={<ICONS.restaurant fontSize="small" />}
          onClick={() => setShowOrders(!showOrders)}
          sx={{ borderRadius: 30, textTransform: "none", fontWeight: 700 }}
        >
          {showOrders ? "Hide Orders" : "View Kitchen Orders"}
        </Button>
      </Stack>

      <Collapse in={showOrders}>
        <Box
          sx={{ mt: 2, pt: 2, borderTop: "1px dashed", borderColor: "divider" }}
        >
          {ordersLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={30} />
            </Box>
          ) : orders.length === 0 ? (
            <NoDataAvailable
              title="No orders found"
              description="No kitchen orders have been placed for this visit yet."
              compact
              minHeight={150}
            />
          ) : (
            <Stack spacing={2}>
              {orders.map((order) => {
                const sortedHistory = [...(order.status_history || [])].sort(
                  (a, b) => new Date(a.changed_at) - new Date(b.changed_at),
                );
                return (
                  <Box
                    key={order.id}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: isDark
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(0,0,0,0.02)",
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      sx={{ mb: 1.5 }}
                    >
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={800}
                          sx={{ textTransform: "uppercase" }}
                        >
                          Order Date
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {dayjs(order.created_at).format("MMM D, YYYY - h:mm A")}
                        </Typography>
                      </Box>
                      <Chip
                        label={order.status.replace("_", " ")}
                        size="small"
                        color={
                          order.status === "delivered"
                            ? "success"
                            : order.status === "cancelled"
                              ? "error"
                              : "primary"
                        }
                        sx={{
                          fontWeight: 800,
                          textTransform: "uppercase",
                          fontSize: "0.6rem",
                        }}
                      />
                    </Stack>
                    <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                      {order.items?.map((item, idx) => (
                        <Typography
                          key={idx}
                          variant="body2"
                          fontWeight={600}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{item.name}</span>
                          <span style={{ opacity: 0.6 }}>×{item.quantity}</span>
                        </Typography>
                      ))}
                    </Stack>
                    <Box
                      sx={{
                        pt: 1,
                        borderTop: "1px dashed",
                        borderColor: "divider",
                      }}
                    >
                      <Button
                        size="small"
                        onClick={() => {
                          setExpandedOrders((prev) => {
                            const next = new Set(prev);
                            if (next.has(order.id)) next.delete(order.id);
                            else next.add(order.id);
                            return next;
                          });
                        }}
                        endIcon={
                          <ICONS.down
                            sx={{
                              transform: expandedOrders?.has(order.id)
                                ? "rotate(180deg)"
                                : "none",
                              transition: "0.2s",
                            }}
                          />
                        }
                        sx={{
                          textTransform: "none",
                          p: 0,
                          color: "text.secondary",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          minHeight: 0,
                        }}
                      >
                        View Timeline
                      </Button>
                      <Collapse in={expandedOrders?.has(order.id)}>
                        <Box sx={{ pl: 0.5, pt: 2 }}>
                          {sortedHistory.map((h, i) => (
                            <Box
                              key={h.id}
                              sx={{
                                display: "flex",
                                gap: 1.5,
                                mb: i < sortedHistory.length - 1 ? 1.5 : 0,
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  mt: 0.5,
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    bgcolor:
                                      i === sortedHistory.length - 1
                                        ? "primary.main"
                                        : "text.disabled",
                                  }}
                                />
                                {i < sortedHistory.length - 1 && (
                                  <Box
                                    sx={{
                                      width: 1,
                                      flex: 1,
                                      bgcolor: "divider",
                                      mt: 0.5,
                                      minHeight: 8,
                                    }}
                                  />
                                )}
                              </Box>
                              <Box>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                >
                                  <Typography
                                    variant="caption"
                                    fontWeight="700"
                                    sx={{ textTransform: "capitalize" }}
                                  >
                                    {h.status.replace("_", " ")}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{ fontSize: "0.55rem", opacity: 0.5 }}
                                  >
                                    {dayjs(h.changed_at).format("MMM D, h:mm A")}
                                  </Typography>
                                  {h.changed_by && (
                                    <Chip
                                      label={h.changed_by}
                                      size="small"
                                      variant="outlined"
                                      sx={(theme) => ({
                                        height: 14,
                                        fontSize: "0.5rem",
                                        fontWeight: 700,
                                        borderStyle: "dashed",
                                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                                      })}
                                    />
                                  )}
                                </Stack>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      </Collapse>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}