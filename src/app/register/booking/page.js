"use client";

import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  Divider,
  MenuItem,
  TextField,
  CircularProgress,
  alpha,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import { createRegistration } from "@/services/registrationService";
import { getDepartments } from "@/services/departmentService";
import { getPublicActiveNdaTemplate } from "@/services/ndaTemplateService";
import NdaTemplateContent from "@/components/NdaTemplateContent";
import { COUNTRY_CODES, getFlagImageUrl } from "@/utils/countryCodes";
import { motion } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import dayjs from "dayjs";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";
import PurposeOfVisitInput from "@/components/PurposeOfVisitInput";
import { useColorMode } from "@/contexts/ThemeContext";
import { parse24To12, convert12To24, formatDate } from "@/utils/dateUtils";
import { validateRequired } from "@/utils/validationUtils";
 
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const PERIODS = ["AM", "PM"];
const getSummaryColors = (isDark) => ({
  primary: isDark ? "#1a1a1a" : "#222222",
  primaryDark: isDark ? "#0b0b0b" : "#111111",
  primaryDeep: isDark ? "#000000" : "#0a0a0a",
  accent: "#f59e0b",
  ink: isDark ? "#f5f5f5" : "#111111",
  inkSoft: isDark ? "#a3a3a3" : "#525252",
  surface: isDark ? "#0f0f0f" : "#f7f7f7",
  cardTop: isDark ? "#1a1a1a" : "#ffffff",
  panel: isDark ? "#171717" : "#ffffff",
  white: "#ffffff",
  edge: isDark ? "#2a2a2a" : "#3a3a3a",
});

const extractVisitorIdentity = (currentSuccess, currentVisitorData) => {
  const normalizeKey = (key) => String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizeValue = (value) => String(value || "").trim();

  const fieldSources = [
    currentSuccess?.fieldValues,
    currentSuccess?.fields,
    currentSuccess?.customFields,
    currentVisitorData?.dynamicFields,
  ];

  const identityTypeKeys = ["id_type", "idType", "identification_type", "document_type", "doc_type"];

  const findFromSources = (keys, matchKey) => {
    for (const src of fieldSources) {
      if (!src || typeof src !== "object") continue;

      for (const key of keys) {
        const val = normalizeValue(src[key]);
        if (val) {
          return {
            value: val,
            matchedKey: key,
          };
        }
      }

      const matchedEntry = Object.entries(src).find(([k, v]) => {
        const text = normalizeValue(v);
        if (!text) return false;
        return typeof matchKey === "function" ? matchKey(normalizeKey(k), k) : false;
      });

      if (matchedEntry) {
        return {
          value: normalizeValue(matchedEntry[1]),
          matchedKey: matchedEntry[0],
        };
      }
    }

    return null;
  };

  const idTypeMatch = findFromSources(
    identityTypeKeys,
    (normalizedKey) => normalizedKey.includes("idtype") || normalizedKey.includes("doctype") || normalizedKey.includes("documenttype"),
  );
  const normalizedIdType = normalizeKey(idTypeMatch?.value || "");

  const omanIdentityMatch = findFromSources(
    ["oman_id", "omanId", "omanid", "oman_id_number", "civil_id", "national_id"],
    (normalizedKey) => normalizedKey.includes("omanid") || normalizedKey.includes("omannationalid") || normalizedKey.includes("civilid"),
  );

  const passportIdentityMatch = findFromSources(
    ["passport_number", "passportNumber", "passport_no", "passportNo", "passport"],
    (normalizedKey) => normalizedKey.includes("passport"),
  );

  const genericIdentityMatch = findFromSources(
    ["id_number", "idNumber", "identification_number", "document_number", "idNo", "id_no"],
    (normalizedKey) => normalizedKey.includes("idnumber") || normalizedKey.includes("identificationnumber") || normalizedKey.includes("documentnumber"),
  );

  const resolvePassportCountry = () => {
    const match = findFromSources(
      [
        "passport_country",
        "passportCountry",
        "passport_nationality",
        "passportNationality",
        "passport_country_code",
        "passportCountryCode",
        "country_of_issue",
        "issuing_country",
        "nationality",
      ],
      (normalizedKey) => {
        const hasPassport = normalizedKey.includes("passport") || normalizedKey.includes("nationality");
        const hasCountry = normalizedKey.includes("country") || normalizedKey.includes("nation");
        return hasPassport ? hasCountry : normalizedKey.includes("nationality");
      },
    );

    const raw = normalizeValue(match?.value);
    if (!raw) return null;

    const rawLower = raw.toLowerCase();
    const normalizedRaw = normalizeKey(raw);

    const byIsoCode = COUNTRY_CODES.find((c) => c.isoCode === rawLower);
    if (byIsoCode) {
      return {
        countryName: byIsoCode.country,
        isoCode: byIsoCode.isoCode,
        flagUrl: getFlagImageUrl(byIsoCode.isoCode),
      };
    }

    const byName = COUNTRY_CODES.find((c) => c.country.toLowerCase() === rawLower);
    if (byName) {
      return {
        countryName: byName.country,
        isoCode: byName.isoCode,
        flagUrl: getFlagImageUrl(byName.isoCode),
      };
    }

    const byLooseName = COUNTRY_CODES.find((c) => normalizeKey(c.country) === normalizedRaw);
    if (byLooseName) {
      return {
        countryName: byLooseName.country,
        isoCode: byLooseName.isoCode,
        flagUrl: getFlagImageUrl(byLooseName.isoCode),
      };
    }

    return {
      countryName: raw,
      isoCode: "",
      flagUrl: "",
    };
  };

  const directCandidates = [
    { type: "passport", value: currentSuccess?.user?.passportNo },
    { type: "passport", value: currentSuccess?.user?.passport_no },
    { type: "oman", value: currentSuccess?.user?.omanId },
    { type: "oman", value: currentSuccess?.user?.oman_id },
    { type: "generic", value: currentSuccess?.user?.idNumber },
    { type: "generic", value: currentSuccess?.user?.id_number },
  ];

  const directIdentityMatch = directCandidates.find((entry) => normalizeValue(entry.value));

  const pickType = () => {
    if (normalizedIdType.includes("oman")) return "oman";
    if (normalizedIdType.includes("passport")) return "passport";
    if (omanIdentityMatch) return "oman";
    if (passportIdentityMatch) return "passport";
    if (directIdentityMatch?.type && directIdentityMatch.type !== "generic") return directIdentityMatch.type;
    return "generic";
  };

  const type = pickType();
  const value = normalizeValue(
    type === "oman"
      ? (omanIdentityMatch?.value || genericIdentityMatch?.value || directIdentityMatch?.value)
      : type === "passport"
        ? (passportIdentityMatch?.value || genericIdentityMatch?.value || directIdentityMatch?.value)
        : (genericIdentityMatch?.value || omanIdentityMatch?.value || passportIdentityMatch?.value || directIdentityMatch?.value),
  );

  if (!value) {
    return {
      value: "",
      label: "ID",
      type: "generic",
      countryName: "",
      isoCode: "",
      flagUrl: "",
    };
  }

  if (type === "oman") {
    return {
      value,
      label: "Oman ID",
      type,
      countryName: "Oman",
      isoCode: "om",
      flagUrl: getFlagImageUrl("om"),
    };
  }

  if (type === "passport") {
    const countryMeta = resolvePassportCountry();
    return {
      value,
      label: countryMeta?.countryName ? `Passport (${countryMeta.countryName})` : "Passport",
      type,
      countryName: countryMeta?.countryName || "",
      isoCode: countryMeta?.isoCode || "",
      flagUrl: countryMeta?.flagUrl || "",
    };
  }

  return {
    value,
    label: "ID",
    type,
    countryName: "",
    isoCode: "",
    flagUrl: "",
  };
};

export default function BookingPage() {
  const router = useRouter();
  const { visitorData, setVisitorData, bookingData, setBookingData, resetVisitorFlow, flowState, setFlowState } = useVisitor();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const SUMMARY_COLORS = getSummaryColors(isDark);
  const isReturning = flowState?.isReturning === true;
  const ndaRequired = isReturning && flowState?.ndaAccepted === false;
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [ndaOpen, setNdaOpen] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const ndaWasRequired = useRef(ndaRequired);
  const summaryDownloadRef = useRef(null);
  const showNdaCheckbox = ndaWasRequired.current;
  const [ndaTemplate, setNdaTemplate] = useState(null);
  const [ndaLoading, setNdaLoading] = useState(false);

  const [bookingType, setBookingType] = useState("custom");
  const [selectedPreset, setSelectedPreset] = useState("fullDay");
  const bookingDate = bookingData.date ? dayjs(bookingData.date) : null;
  const hasValidBookingDate = bookingDate?.isValid?.() === true;

  useEffect(() => {
    if (isReturning) {
      getDepartments(true).then((res) => {
        if (Array.isArray(res)) setDepartments(res);
      });
    }
  }, [isReturning]);

  useEffect(() => {
    if (ndaRequired) {
      setNdaLoading(true);
      getPublicActiveNdaTemplate()
        .then((res) => setNdaTemplate(res))
        .catch(() => setNdaTemplate(null))
        .finally(() => setNdaLoading(false));
    }
  }, [ndaRequired]);

  const handleDateChange = (newDate) => {
    setBookingData((prev) => ({ ...prev, date: newDate }));
  };

  const handleTimePartChange = (type, part, value) => {
    const current = parse24To12(bookingData[type]);
    const next = { ...current, [part]: value };
    const time24 = convert12To24(next.hour12, next.minute, next.ampm);
    
    setBookingData((prev) => {
      let newData = { ...prev, [type]: time24 };
      
      if (bookingType === "custom") {
        if (type === "timeFrom" && newData.timeTo <= time24) {
           let [h, m] = time24.split(":").map(Number);
           h = (h + 1) % 24;
           newData.timeTo = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        } else if (type === "timeTo" && newData.timeFrom >= time24) {
           let [h, m] = time24.split(":").map(Number);
           newData.timeFrom = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        }
      } else if (bookingType === "preset" && selectedPreset === "fullDay") {
        if (type === "timeFrom") {
          newData.timeTo = time24;
        } else if (type === "timeTo") {
          newData.timeFrom = time24;
        }
      }
      
      return newData;
    });
  };

  const renderTimeDropdowns = (type, label) => {
    const { hour12, minute, ampm } = parse24To12(bookingData[type]);
    
    return (
      <Box>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ ml: 1, mb: 0.5, display: "block" }}>
          {label}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>Hr</Typography>
            <TextField
              select
              size="small"
              value={hour12}
              onChange={(e) => handleTimePartChange(type, "hour12", e.target.value)}
              sx={{ 
                width: "100%",
                "& .MuiOutlinedInput-root": { borderRadius: 30 },
                "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 }
              }}
            >
              {HOURS.map((h) => (
                <MenuItem key={h} value={h} sx={{ fontSize: "0.75rem" }}>{h}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>Min</Typography>
            <TextField
              select
              size="small"
              value={minute}
              onChange={(e) => handleTimePartChange(type, "minute", e.target.value)}
              sx={{ 
                width: "100%",
                "& .MuiOutlinedInput-root": { borderRadius: 30 },
                "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 }
              }}
            >
              {MINUTES.map((m) => (
                <MenuItem key={m} value={m} sx={{ fontSize: "0.75rem" }}>{m}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: 700, ml: 1, color: "text.secondary", textTransform: "uppercase" }}>AM/PM</Typography>
            <TextField
              select
              size="small"
              value={ampm}
              onChange={(e) => handleTimePartChange(type, "ampm", e.target.value)}
              sx={{ 
                width: "100%",
                "& .MuiOutlinedInput-root": { borderRadius: 30 },
                "& .MuiSelect-select": { fontSize: "0.75rem", py: 1, px: 1 }
              }}
            >
              {PERIODS.map((p) => (
                <MenuItem key={p} value={p} sx={{ fontSize: "0.75rem" }}>{p}</MenuItem>
              ))}
            </TextField>
          </Box>
        </Stack>
      </Box>
    );
  };

  const handleSubmit = async () => {
    if (!hasValidBookingDate) return;

    if (isReturning) {
      const errs = {};
      if (!visitorData.departmentId) errs.departmentId = "Department is required";
      const purposeErr = validateRequired(visitorData.purposeOfVisit, "Purpose of Visit");
      if (purposeErr) errs.purposeOfVisit = purposeErr;
      if (showNdaCheckbox && !ndaAccepted) errs.nda = "You must accept the NDA before submitting";
      if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    }

    setSubmitting(true);
    try {
      let fromDate, toDate;
      if (bookingType === "preset") {
        const date = bookingDate;
        let from = date.clone();
        let to = date.clone();

        if (selectedPreset === "fullDay") {
          const fromParts = bookingData.timeFrom.split(":");
          const toParts = bookingData.timeTo.split(":");
          from = from.startOf("day").hour(parseInt(fromParts[0])).minute(parseInt(fromParts[1]));
          to = to.add(1, "day").startOf("day").hour(parseInt(toParts[0])).minute(parseInt(toParts[1]));
        } else if (selectedPreset === "fullWeek") {
          from = from.startOf("day");
          to = to.add(6, "days").endOf("day");
        } else if (selectedPreset === "fullMonth") {
          from = from.startOf("day");
          to = to.add(30, "days").endOf("day");
        }

        fromDate = from.format("YYYY-MM-DD");
        toDate = to.format("YYYY-MM-DD");
      } else {
        fromDate = bookingDate.format("YYYY-MM-DD");
        toDate = bookingDate.format("YYYY-MM-DD");
      }
      
      const payload = {
        userId: visitorData.userId,
        ndaAccepted: flowState?.ndaAccepted === true || ndaAccepted,
        requestedFrom: dayjs(`${fromDate}T${bookingData.timeFrom}`).toISOString(),
        requestedTo: dayjs(`${toDate}T${bookingData.timeTo}`).toISOString(),
        phoneIsoCode: visitorData.phoneIsoCode,
        purposeOfVisit: visitorData.purposeOfVisit,
        departmentId: visitorData.departmentId || undefined,
        fieldValues: {
          ...visitorData.dynamicFields,
          full_name: visitorData.fullName || visitorData.dynamicFields.full_name,
        },
      };

      const res = await createRegistration(payload);
      if (!res.error) {
        setSuccess(res);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadSummary = async () => {
    if (!summaryDownloadRef.current || !success) return;

    const canvas = await html2canvas(summaryDownloadRef.current, {
      backgroundColor: null,
      useCORS: true,
      scale: Math.max(window.devicePixelRatio || 1, 2),
      logging: false,
      ignoreElements: (element) => element?.dataset?.excludeDownload === "true",
    });

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    const fileSafeValue = (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const identityValue = extractVisitorIdentity(success, visitorData);
    const downloadName = fileSafeValue(success?.user?.fullName || visitorData.fullName || "visitor");
    const downloadId = fileSafeValue(identityValue?.value || success?.qr_token || success?.qrToken || success?.id || Date.now());
    link.download = `registration-summary-${downloadName}-${downloadId}.png`;
    link.click();
  };

  if (success) {
    const visitorName = success.user?.fullName || visitorData.fullName || "Visitor";
    const visitorEmail = success.user?.email || visitorData.email;
    const rawPhone = success.user?.phone || visitorData.phone;
    const isoCode = (visitorData.phoneIsoCode || visitorData.iso_code || "").toLowerCase();
    const dialCode = COUNTRY_CODES.find((c) => c.isoCode === isoCode)?.code ?? "";
    const visitorPhone = rawPhone ? `${dialCode} ${rawPhone}`.trim() : null;

    const deptName = success.department?.name || departments.find((d) => d.id === visitorData.departmentId)?.name;
    const purposeText = success.purposeOfVisit || visitorData.purposeOfVisit;

    const fromDate = success.requestedFrom ? new Date(success.requestedFrom) : null;
    const toDate = success.requestedTo ? new Date(success.requestedTo) : null;
    const qrToken = success.qr_token || success.qrToken || success.id;

    const fmtDate = (d) =>
      d ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(d) : "—";
    const fmtTime = (d) =>
      d ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(d) : "—";

    const sameDay = fromDate && toDate && fmtDate(fromDate) === fmtDate(toDate);
    const contactLine = [visitorEmail, visitorPhone].filter(Boolean).join("  ·  ");
    const summaryCardBorder = isDark
      ? alpha(SUMMARY_COLORS.white, 0.22)
      : alpha(SUMMARY_COLORS.primary, 0.14);
    const summarySectionBorder = isDark
      ? alpha(SUMMARY_COLORS.white, 0.18)
      : alpha(SUMMARY_COLORS.primary, 0.12);
    const summaryRowBorder = isDark
      ? alpha(SUMMARY_COLORS.white, 0.16)
      : alpha(SUMMARY_COLORS.primary, 0.1);
    const summaryHeaderBg = isDark
      ? SUMMARY_COLORS.white
      : `linear-gradient(135deg, ${SUMMARY_COLORS.primaryDeep} 0%, ${SUMMARY_COLORS.primary} 56%, ${SUMMARY_COLORS.edge} 100%)`;
    const summaryHeaderText = isDark ? SUMMARY_COLORS.primaryDark : SUMMARY_COLORS.white;
    const summaryHeaderMutedText = isDark
      ? alpha(SUMMARY_COLORS.primaryDark, 0.72)
      : alpha(SUMMARY_COLORS.white, 0.82);

    const visitorIdentity = extractVisitorIdentity(success, visitorData);
    const hostBrandName =
      success?.hostDetails?.name ||
      success?.host?.name ||
      success?.hostName ||
      success?.host_name ||
      "Sinan VMS";

    const DetailRow = ({ label, value, index }) => (
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${summaryRowBorder}`,
          bgcolor: index % 2 === 0
            ? (isDark ? alpha("#ffffff", 0.06) : alpha("#000000", 0.035))
            : "transparent",
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: SUMMARY_COLORS.inkSoft,
            textTransform: "uppercase",
            letterSpacing: 1.1,
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="body1"
          fontWeight={700}
          sx={{
            color: SUMMARY_COLORS.ink,
            lineHeight: 1.45,
            mt: 0.45,
            wordBreak: "break-word",
          }}
        >
          {value}
        </Typography>
      </Box>
    );

    const summaryRows = [
      {
        label: sameDay ? "Visit Date" : "From",
        value: sameDay
          ? `${fmtDate(fromDate)}  ·  ${fmtTime(fromDate)} – ${fmtTime(toDate)}`
          : `${fmtDate(fromDate)}  ·  ${fmtTime(fromDate)}`,
      },
      ...(!sameDay
        ? [{ label: "To", value: `${fmtDate(toDate)}  ·  ${fmtTime(toDate)}` }]
        : []),
      ...(deptName ? [{ label: "Department", value: deptName }] : []),
      ...(purposeText ? [{ label: "Purpose of Visit", value: purposeText }] : []),
    ];

    return (
      <VisitorLayout justifyContent="center">
        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.35 }} style={{ width: "100%" }}>
          <Stack spacing={2.2}>

            <Stack alignItems="center" spacing={0.5}>
              <Typography variant="h6" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive" }}>
                Booking Summary
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 360 }}>
                Application submitted successfully. Download your summary card below.
              </Typography>
            </Stack>

            <Box ref={summaryDownloadRef} sx={{ width: "100%", maxWidth: 430, mx: "auto" }}>
              <Paper
                elevation={0}
                sx={{
                  position: "relative",
                  width: "100%",
                  overflow: "hidden",
                  borderRadius: "30px",
                  background: `linear-gradient(180deg, ${SUMMARY_COLORS.cardTop} 0%, ${SUMMARY_COLORS.surface} 100%)`,
                  border: `1px solid ${summaryCardBorder}`,
                  boxShadow: `0 28px 70px ${alpha(SUMMARY_COLORS.primaryDeep, 0.24)}`,
                }}
              >
                <Box
                  sx={{
                    position: "relative",
                    px: { xs: 2.5, sm: 3 },
                    pt: 3,
                    pb: 4.25,
                    overflow: "hidden",
                    background: summaryHeaderBg,
                  }}
                >
                  <Box
                    sx={{
                      position: "absolute",
                      width: 180,
                      height: 180,
                      borderRadius: "50%",
                      top: -72,
                      right: -48,
                      bgcolor: isDark ? alpha(SUMMARY_COLORS.primaryDark, 0.06) : alpha(SUMMARY_COLORS.white, 0.08),
                    }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      bottom: -60,
                      left: -28,
                      bgcolor: isDark ? alpha(SUMMARY_COLORS.primaryDark, 0.04) : alpha(SUMMARY_COLORS.white, 0.05),
                    }}
                  />

                  <Box sx={{ position: "relative", zIndex: 1 }}>
                    <Typography
                      variant="h5"
                      fontWeight={800}
                      sx={{
                        color: summaryHeaderText,
                        lineHeight: 1.15,
                        wordBreak: "break-word",
                        mb: 1,
                      }}
                    >
                      {visitorName}
                    </Typography>
                    {visitorIdentity?.value && (
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25, flexWrap: "wrap" }}>
                        {visitorIdentity?.flagUrl && (
                          <Box
                            component="img"
                            src={visitorIdentity.flagUrl}
                            alt={visitorIdentity.countryName || "Passport Country"}
                            sx={{
                              width: 18,
                              height: 12,
                              objectFit: "cover",
                              borderRadius: 0.4,
                              border: `1px solid ${alpha(SUMMARY_COLORS.primaryDark, 0.16)}`,
                            }}
                          />
                        )}
                        <Typography
                          variant="caption"
                          sx={{ display: "block", color: summaryHeaderMutedText, wordBreak: "break-word" }}
                        >
                          {visitorIdentity.label}: {visitorIdentity.value}
                        </Typography>
                      </Stack>
                    )}
                    {contactLine && (
                      <Typography
                        variant="caption"
                        sx={{ display: "block", mt: 0.85, color: summaryHeaderMutedText, wordBreak: "break-word" }}
                      >
                        {contactLine}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Box sx={{ px: { xs: 2.5, sm: 3 }, py: 3 }}>
                  <Box
                    sx={{
                      mb: 2.25,
                      borderRadius: 4,
                      overflow: "hidden",
                      bgcolor: SUMMARY_COLORS.panel,
                      border: `1px solid ${summarySectionBorder}`,
                    }}
                  >
                    {summaryRows.map((row, index) => (
                      <DetailRow key={row.label} label={row.label} value={row.value} index={index} />
                    ))}
                  </Box>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: "26px",
                      background: SUMMARY_COLORS.panel,
                      border: `1px solid ${summarySectionBorder}`,
                      boxShadow: `0 14px 30px ${alpha(SUMMARY_COLORS.primaryDeep, 0.08)}`,
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "center", mb: qrToken ? 1.5 : 0 }}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 3,
                          bgcolor: SUMMARY_COLORS.white,
                          border: "1px solid #e4eef1",
                        }}
                      >
                        <QRCodeCanvas
                          value={qrToken || "N/A"}
                          size={170}
                          bgColor={SUMMARY_COLORS.white}
                          fgColor={SUMMARY_COLORS.primaryDark}
                          includeMargin={false}
                        />
                      </Box>
                    </Box>

                    {qrToken && (
                      <Box
                        sx={{
                          px: 1.75,
                          py: 0.85,
                          borderRadius: 999,
                          display: "flex",
                          justifyContent: "center",
                        }}
                      >
                        <Typography
                          variant="caption"
                          fontWeight={700}
                          sx={{
                            color: isDark ? SUMMARY_COLORS.white : SUMMARY_COLORS.primaryDark,
                            letterSpacing: 0.8,
                            wordBreak: "break-all",
                          }}
                        >
                          Token: {qrToken}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  <Typography
                    variant="caption"
                    display="block"
                    textAlign="center"
                    sx={{ color: SUMMARY_COLORS.inkSoft }}
                  >
                    Powered by {hostBrandName}
                  </Typography>
                </Box>
              </Paper>
            </Box>

            <Box
              sx={{
                px: 1.75,
                py: 0.9,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.75,
                bgcolor: (theme) => alpha(theme.palette.warning.main, isDark ? 0.24 : 0.24),
                border: "1px solid",
                borderColor: (theme) => alpha(theme.palette.warning.main, isDark ? 0.5 : 0.46),
                width: "fit-content",
                mx: "auto",
              }}
            >
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "warning.main" }} />
              <Typography
                variant="caption"
                fontWeight={800}
                sx={{
                  color: isDark ? "#fef3c7" : "#7c2d12",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontSize: "0.72rem",
                }}
              >
                Status: Pending Review
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
              <Button
                variant="contained"
                startIcon={<ICONS.download />}
                onClick={handleDownloadSummary}
                sx={{ py: 1.5, borderRadius: 30, fontWeight: 700, width: "100%", flex: 1 }}
              >
                Save
              </Button>

              <Button
                variant="contained"
                startIcon={<ICONS.home />}
                onClick={() => { resetVisitorFlow(); router.push("/"); }}
                sx={{ py: 1.5, borderRadius: 30, fontWeight: 700, width: "100%", flex: 1 }}
              >
                Home
              </Button>
            </Stack>

          </Stack>
        </motion.div>
      </VisitorLayout>
    );
  }

  return (
    <>
    <VisitorLayout
      title="Appointment Booking"
      subtitle="Select your preferred visit date and arrival time."
      maxWidth={900}
    >
      <Stack spacing={2}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h5" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive" }}>
            Schedule Your Visit
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Select a convenient date and time to visit our premises.
          </Typography>
        </Box>

        <Divider />

        {isReturning && (
          <Stack spacing={2}>
            <FormControl fullWidth required error={Boolean(fieldErrors.departmentId)}>
              <InputLabel>Department</InputLabel>
              <Select
                value={visitorData.departmentId || ""}
                label="Department"
                onChange={(e) => {
                  setVisitorData((prev) => ({ ...prev, departmentId: e.target.value }));
                  if (fieldErrors.departmentId) setFieldErrors((p) => { const n = { ...p }; delete n.departmentId; return n; });
                }}
                sx={{ borderRadius: 30 }}
              >
                {departments.map((dept) => (
                  <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                ))}
              </Select>
              {fieldErrors.departmentId && <FormHelperText>{fieldErrors.departmentId}</FormHelperText>}
            </FormControl>

            <PurposeOfVisitInput
              value={visitorData.purposeOfVisit || ""}
              onChange={(val) => {
                setVisitorData((prev) => ({ ...prev, purposeOfVisit: val }));
                if (fieldErrors.purposeOfVisit) setFieldErrors((p) => { const n = { ...p }; delete n.purposeOfVisit; return n; });
              }}
              required
              error={Boolean(fieldErrors.purposeOfVisit)}
              helperText={fieldErrors.purposeOfVisit}
              rounded
            />

            {showNdaCheckbox && (
              <Stack spacing={0.75}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ndaAccepted}
                      onChange={() => {
                        if (!ndaAccepted) setNdaOpen(true);
                        else setNdaAccepted(false);
                      }}
                      color="primary"
                    />
                  }
                  label={
                    <Typography component="span" variant="body2" fontWeight={600}>
                      I have read and agree to the Non-Disclosure Agreement
                    </Typography>
                  }
                />
                <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>
                  {ndaAccepted
                    ? "NDA accepted. You may proceed."
                    : "Your previous NDA has expired. Please review and accept the NDA before submitting."}
                </Typography>
                {fieldErrors.nda && (
                  <Typography variant="caption" color="error.main" sx={{ pl: 4 }}>
                    {fieldErrors.nda}
                  </Typography>
                )}
              </Stack>
            )}

            <Divider />
          </Stack>
        )}

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, px: 2 }}>
              Select Date
            </Typography>
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 4,
                bgcolor: "action.hover",
                "& .MuiDateCalendar-root": { width: "100%", height: "auto", transform: "scale(0.95)", transformOrigin: "top" },
              }}
            >
              <DateCalendar
                value={hasValidBookingDate ? bookingDate : null}
                onChange={handleDateChange}
                disablePast
              />
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Select Time
            </Typography>
            <Box sx={{ mt: 0 }}>
              <Stack spacing={2}>
                {/* Toggle between Custom and Preset using Tabs */}
                <Tabs
                value={bookingType}
                onChange={(_, value) => {
                  setBookingType(value);
                  // When switching to preset, ensure timeTo is synced for the active preset
                  if (value === "preset") {
                    if (selectedPreset === "fullDay") {
                      setBookingData((prev) => ({ ...prev, timeTo: prev.timeFrom }));
                    } else {
                      setBookingData((prev) => ({ ...prev, timeFrom: "00:00", timeTo: "23:59" }));
                    }
                  }
                }}
                variant="fullWidth"
                sx={{
                  minHeight: 46,
                  bgcolor: (theme) => alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
                  borderRadius: 999,
                  p: 0.5,
                  "& .MuiTabs-indicator": { display: "none" },
                }}
              >
                <Tab
                  value="custom"
                  icon={<ICONS.time fontSize="small" />}
                  iconPosition="start"
                  label="Custom"
                  sx={{
                    minHeight: 38,
                    borderRadius: 999,
                    fontWeight: 800,
                    textTransform: "none",
                    "&.Mui-selected": {
                      bgcolor: "background.paper",
                      color: "text.primary",
                      boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                    },
                  }}
                />
                <Tab
                  value="preset"
                  icon={<ICONS.event fontSize="small" />}
                  iconPosition="start"
                  label="Preset"
                  sx={{
                    minHeight: 38,
                    borderRadius: 999,
                    fontWeight: 800,
                    textTransform: "none",
                    "&.Mui-selected": {
                      bgcolor: "background.paper",
                      color: "text.primary",
                      boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                    },
                  }}
                />
              </Tabs>

              {/* Custom Time Section */}
              {bookingType === "custom" && (
                <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2, border: "1px solid", borderColor: "divider", minHeight: 320 }}>
                  <Stack spacing={2} sx={{ mb: 2 }}>
                    {renderTimeDropdowns("timeFrom", "Expected Arrival (From)")}
                    {renderTimeDropdowns("timeTo", "Expected Departure (To)")}
                  </Stack>

                  <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                        Visit duration: {dayjs(`2000-01-01 ${bookingData.timeTo}`).diff(dayjs(`2000-01-01 ${bookingData.timeFrom}`), 'minute')} min
                      </Typography>
                    </Stack>
                  </Box>
                </Box>
              )}

              {/* Preset Options Section */}
              {bookingType === "preset" && (
                <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2, border: "1px solid", borderColor: "divider", minHeight: 320 }}>
                  {/* Preset Type Selector */}
                  <Box sx={{ mb: 2.5 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1, textTransform: "uppercase", fontSize: "0.65rem" }}>
                      Preset Type
                    </Typography>
                    <TextField
                      fullWidth
                      select
                      size="small"
                      value={selectedPreset || "fullDay"}
                      onChange={(e) => {
                        const preset = e.target.value;
                        setSelectedPreset(preset);
                        
                        if (preset === "fullDay") {
                          setBookingData((prev) => ({
                            ...prev,
                            timeTo: prev.timeFrom,
                          }));
                        } else {
                          setBookingData((prev) => ({
                            ...prev,
                            timeFrom: "00:00",
                            timeTo: "23:59",
                          }));
                        }
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": { borderRadius: 2 },
                      }}
                    >
                      <MenuItem value="fullDay">Full Day</MenuItem>
                      <MenuItem value="fullWeek">Full Week</MenuItem>
                      <MenuItem value="fullMonth">Full Month</MenuItem>
                    </TextField>
                  </Box>

                  {/* Date Range Display */}
                  {hasValidBookingDate && (
                    <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.5, textTransform: "uppercase", fontSize: "0.65rem" }}>
                        Date Range
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="text.primary">
                        {(() => {
                          const date = bookingDate;
                          let from = date.clone();
                          let to = date.clone();

                          if (selectedPreset === "fullDay") {
                            const fromParts = bookingData.timeFrom.split(":");
                            const toParts = bookingData.timeTo.split(":");
                            from = from.startOf("day").hour(parseInt(fromParts[0])).minute(parseInt(fromParts[1]));
                            to = to.add(1, "day").startOf("day").hour(parseInt(toParts[0])).minute(parseInt(toParts[1]));
                          } else if (selectedPreset === "fullWeek") {
                            from = from.startOf("day");
                            to = to.add(6, "days").endOf("day");
                          } else if (selectedPreset === "fullMonth") {
                            from = from.startOf("day");
                            to = to.add(30, "days").endOf("day");
                          }

                          return `${formatDate(from.toDate())} to ${formatDate(to.toDate())}`;
                        })()}
                      </Typography>
                    </Box>
                  )}

                  {/* Time inputs for preset */}
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 2, textTransform: "uppercase", fontSize: "0.65rem" }}>
                    Time
                  </Typography>
                  <Stack spacing={2}>
                    {renderTimeDropdowns("timeFrom", selectedPreset === "fullDay" ? "Full Day Start Time" : "Start Time")}
                    {selectedPreset !== "fullDay" && renderTimeDropdowns("timeTo", "End Time")}
                    {selectedPreset === "fullDay" && (
                      <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <ICONS.info sx={{ fontSize: 16, color: "text.secondary" }} />
                          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 12 }}>
                            Full day booking: Same time for start and end
                          </Typography>
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}
            </Stack>
            </Box>
          </Grid>
        </Grid>

        <Divider />

        <Stack direction="row" spacing={2}>
          {!isReturning && (
            <Button
              variant="outlined"
              fullWidth
              disabled={submitting}
              startIcon={<ICONS.back />}
              onClick={() => router.back()}
              sx={{ py: 1.5, borderRadius: 30 }}
            >
              Back
            </Button>
          )}
          <Button
            variant="contained"
            fullWidth
            disabled={submitting || !hasValidBookingDate}
            startIcon={submitting ? <CircularProgress size={24} color="inherit" /> : <ICONS.send />}
            onClick={handleSubmit}
            sx={{ py: 1.5, borderRadius: 30 }}
          >
            {submitting ? "Sending..." : "Submit"}
          </Button>
        </Stack>
      </Stack>
    </VisitorLayout>

    {/* NDA Modal — must re-sign expired NDA */}
    <Dialog open={ndaOpen} onClose={() => setNdaOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6" fontWeight={800} component="span" sx={{ fontFamily: "'Comfortaa', cursive" }}>
          {ndaTemplate?.name || "Non-Disclosure Agreement"}
        </Typography>
        <IconButton onClick={() => setNdaOpen(false)}>
          <ICONS.close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: "rgba(0,0,0,0.05)" }}>
        {ndaLoading ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">Loading NDA...</Typography>
          </Stack>
        ) : (
          <NdaTemplateContent template={ndaTemplate} />
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button variant="outlined" onClick={() => setNdaOpen(false)} sx={{ borderRadius: 30 }}>
          Close
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={<ICONS.check />}
          onClick={() => {
            setNdaAccepted(true);
            setFlowState((prev) => ({ ...prev, ndaAccepted: true }));
            setNdaOpen(false);
            if (fieldErrors.nda) setFieldErrors((p) => { const n = { ...p }; delete n.nda; return n; });
          }}
          sx={{ borderRadius: 30 }}
        >
          I Agree
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
