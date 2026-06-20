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
  alpha,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useVisitor } from "@/contexts/VisitorContext";
import { COUNTRY_CODES, getFlagImageUrl } from "@/utils/countryCodes";
import { motion } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import ICONS from "@/utils/iconUtil";
import VisitorLayout from "@/components/layout/VisitorLayout";
import { useColorMode } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateBatch } from "@/services/translationService";
import getStartIconSpacing from "@/utils/getStartIconSpacing";

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

const normalizeKey = (key) => String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizeValue = (value) => String(value || "").trim();

function extractVisitorIdentity(registration, visitorData) {
  const fieldSources = [
    registration?.fieldValues,
    registration?.fields,
    registration?.customFields,
    visitorData?.dynamicFields,
  ];

  const findFromSources = (keys, matchFn) => {
    for (const src of fieldSources) {
      if (!src || typeof src !== "object") continue;
      for (const key of keys) {
        const val = normalizeValue(src[key]);
        if (val) return { value: val, matchedKey: key };
      }
      const entry = Object.entries(src).find(([k, v]) => {
        const text = normalizeValue(v);
        return text && typeof matchFn === "function" ? matchFn(normalizeKey(k), k) : false;
      });
      if (entry) return { value: normalizeValue(entry[1]), matchedKey: entry[0] };
    }
    return null;
  };

  const idTypeMatch = findFromSources(
    ["id_type", "idType", "identification_type", "document_type", "doc_type"],
    (nk) => nk.includes("idtype") || nk.includes("doctype"),
  );
  const normalizedIdType = normalizeKey(idTypeMatch?.value || "");

  const omanMatch = findFromSources(
    ["oman_id", "omanId", "oman_id_number", "civil_id", "national_id"],
    (nk) => nk.includes("omanid") || nk.includes("civilid"),
  );
  const passportMatch = findFromSources(
    ["passport_number", "passportNumber", "passport_no", "passport"],
    (nk) => nk.includes("passport"),
  );
  const genericMatch = findFromSources(
    ["id_number", "idNumber", "identification_number", "document_number"],
    (nk) => nk.includes("idnumber") || nk.includes("identificationnumber"),
  );

  const directCandidates = [
    { type: "passport", value: registration?.user?.passportNo },
    { type: "oman", value: registration?.user?.omanId },
    { type: "generic", value: registration?.user?.idNumber },
  ];
  const directMatch = directCandidates.find((e) => normalizeValue(e.value));

  const type =
    normalizedIdType.includes("oman") ? "oman"
    : normalizedIdType.includes("passport") ? "passport"
    : omanMatch ? "oman"
    : passportMatch ? "passport"
    : directMatch?.type !== "generic" && directMatch?.type ? directMatch.type
    : "generic";

  const value = normalizeValue(
    type === "oman"
      ? (omanMatch?.value || genericMatch?.value || directMatch?.value)
      : type === "passport"
        ? (passportMatch?.value || genericMatch?.value || directMatch?.value)
        : (genericMatch?.value || omanMatch?.value || passportMatch?.value || directMatch?.value),
  );

  if (!value) return { value: "", label: "ID", type: "generic", countryName: "", isoCode: "", flagUrl: "" };

  if (type === "oman") return { value, label: "Oman ID", type, countryName: "Oman", isoCode: "om", flagUrl: getFlagImageUrl("om") };

  if (type === "passport") {
    const countryRaw = normalizeValue(
      findFromSources(["passport_country", "passportCountry", "nationality", "country_of_issue"], (nk) => nk.includes("passport") || nk.includes("nationality"))?.value,
    );
    const byIso = COUNTRY_CODES.find((c) => c.isoCode === countryRaw.toLowerCase());
    const byName = COUNTRY_CODES.find((c) => c.country.toLowerCase() === countryRaw.toLowerCase());
    const country = byIso || byName;
    return {
      value,
      label: country ? `Passport (${country.country})` : "Passport",
      type,
      countryName: country?.country || countryRaw,
      isoCode: country?.isoCode || "",
      flagUrl: country ? getFlagImageUrl(country.isoCode) : "",
    };
  }

  return { value, label: "ID", type, countryName: "", isoCode: "", flagUrl: "" };
}

function getArCountryName(isoCode) {
  if (!isoCode) return "";
  try {
    const name = new Intl.DisplayNames(["ar"], { type: "region" }).of(isoCode.toUpperCase());
    return (!name || name.toUpperCase() === isoCode.toUpperCase()) ? "" : name;
  } catch { return ""; }
}

export default function SummaryPage() {
  const router = useRouter();
  const { resetVisitorFlow } = useVisitor();
  const { mode } = useColorMode();
  const { t, lang, isRtl } = useLanguage();
  const isDark = mode === "dark";
  const SUMMARY_COLORS = getSummaryColors(isDark);

  const [registration, setRegistration] = useState(null);
  const [visitorData, setVisitorData] = useState(null);
  const summaryRef = useRef(null);
  const [qrImageFailed, setQrImageFailed] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [translatedDynamic, setTranslatedDynamic] = useState({});

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("vms_summary");
      if (!raw) { router.replace("/"); return; }
      const { registration: reg, visitorData: vd } = JSON.parse(raw);
      setRegistration(reg);
      setVisitorData(vd);
    } catch {
      router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    if (lang !== "ar" || !registration) { setTranslatedDynamic({}); return; }
    const name = registration?.user?.fullName || visitorData?.fullName || "";
    const dept = registration?.department?.name || "";
    const purpose = registration?.purposeOfVisit || "";
    const brand = registration?.hostName || registration?.host?.name || registration?.hostDetails?.name || "";
    const texts = [name, dept, purpose, brand].filter(Boolean);
    if (!texts.length) return;
    translateBatch(texts, "ar").then((results) => {
      const map = {};
      let idx = 0;
      if (name) map.name = results[idx++] || name;
      if (dept) map.dept = results[idx++] || dept;
      if (purpose) map.purpose = results[idx++] || purpose;
      if (brand) map.brand = results[idx] || brand;
      setTranslatedDynamic(map);
    });
  }, [lang, registration, visitorData]);

  const handleDownload = async () => {
    if (!summaryRef.current) return;
    const CARD_WIDTH = 430;
    const el = summaryRef.current;

    // Capture canvas pixel data BEFORE cloning — cloneNode() creates blank canvases
    const canvasDataUrls = Array.from(el.querySelectorAll("canvas")).map((c) => {
      try { return c.toDataURL(); } catch { return null; }
    });

    // Clone off-screen so the visible card never resizes
    const clone = el.cloneNode(true);
    clone.style.position = "fixed";
    clone.style.top = "-9999px";
    clone.style.left = "-9999px";
    clone.style.width = `${CARD_WIDTH}px`;
    clone.style.maxWidth = `${CARD_WIDTH}px`;
    clone.style.minWidth = `${CARD_WIDTH}px`;
    document.body.appendChild(clone);

    // Ensure custom fonts (DINNextLTArabic, Comfortaa) are fully loaded before capture
    await document.fonts.ready;
    await Promise.allSettled([
      document.fonts.load("700 16px DINNextLTArabic"),
      document.fonts.load("400 16px DINNextLTArabic"),
      document.fonts.load("700 16px Comfortaa"),
    ]);

    const canvas = await html2canvas(clone, {
      backgroundColor: null,
      useCORS: true,
      scale: 2,
      logging: false,
      ignoreElements: (node) => node?.dataset?.excludeDownload === "true",
      onclone: (_doc, clonedEl) => {
        clonedEl.style.width = `${CARD_WIDTH}px`;
        clonedEl.style.maxWidth = `${CARD_WIDTH}px`;
        clonedEl.style.minWidth = `${CARD_WIDTH}px`;

        // Replace each blank cloned canvas with an <img> using the captured data URL
        clonedEl.querySelectorAll("canvas").forEach((c, i) => {
          const dataUrl = canvasDataUrls[i];
          if (!dataUrl) return;
          const img = _doc.createElement("img");
          img.src = dataUrl;
          img.width = c.width;
          img.height = c.height;
          img.style.cssText = c.style.cssText;
          c.replaceWith(img);
        });

        clonedEl.querySelectorAll("[data-contact-icon]").forEach((node) => {
          const type = node.getAttribute("data-contact-icon");
          const span = _doc.createElement("span");
          span.textContent = type === "email" ? "✉" : "✆";
          span.style.fontSize = "12px";
          span.style.color = node.style.color || "inherit";
          node.replaceWith(span);
        });
      },
    });

    document.body.removeChild(clone);
    const fileSafe = (v) => String(v || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const identity = extractVisitorIdentity(registration, visitorData);
    const name = fileSafe(registration?.user?.fullName || visitorData?.fullName || "visitor");
    const id = fileSafe(identity?.value || registration?.qrToken || registration?.id || Date.now());
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `registration-summary-${name}-${id}.png`;
    link.click();
  };

  const handleHome = () => {
    sessionStorage.removeItem("vms_summary");
    resetVisitorFlow();
    router.push("/");
  };

  const visitorName = translatedDynamic.name || registration?.user?.fullName || visitorData?.fullName || "Visitor";
  const visitorEmail = registration?.user?.email || visitorData?.email;
  const rawPhone = registration?.user?.phone || visitorData?.phone;
  const isoCode = (visitorData?.phoneIsoCode || visitorData?.iso_code || "").toLowerCase();
  const dialCode = COUNTRY_CODES.find((c) => c.isoCode === isoCode)?.code ?? "";
  const visitorPhone = rawPhone ? `${dialCode} ${rawPhone}`.trim() : null;

  const deptName = registration?.department?.name;
  const purposeText = registration?.purposeOfVisit;
  const fromDate = registration?.requestedFrom ? new Date(registration.requestedFrom) : null;
  const toDate = registration?.requestedTo ? new Date(registration.requestedTo) : null;
  const qrToken = registration?.qr_token || registration?.qrToken || registration?.id;
  const hostBrandName = registration?.hostName || registration?.host?.name || registration?.hostDetails?.name;
  const visitorIdentity = extractVisitorIdentity(registration, visitorData);
  if (lang === "ar" && visitorIdentity?.value) {
    if (visitorIdentity.type === "passport") {
      const arName = getArCountryName(visitorIdentity.isoCode) || visitorIdentity.countryName;
      visitorIdentity.label = arName ? `جواز سفر (${arName})` : "جواز سفر";
    } else if (visitorIdentity.type === "oman") {
      visitorIdentity.label = "الهوية العُمانية";
    } else {
      visitorIdentity.label = "هوية";
    }
  }
  const qrImageSrc = `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '')}/qr?token=${encodeURIComponent(qrToken || '')}&v=${encodeURIComponent(registration?.updatedAt || registration?.createdAt || registration?.id || '1')}`;

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    setQrImageFailed(false);
    setQrImageUrl(null);

    if (!qrToken) return undefined;

    const loadQr = async () => {
      try {
        const response = await fetch(qrImageSrc, { cache: 'no-store' });
        if (!response.ok) throw new Error(`QR image request failed: ${response.status}`);
        const blob = await response.blob();
        if (!blob.size) throw new Error('QR image response was empty');
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setQrImageUrl(objectUrl);
      } catch {
        if (!cancelled) setQrImageFailed(true);
      }
    };

    loadQr();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [qrImageSrc, qrToken]);

  if (!registration || !visitorData) return null;

  const locale = lang === "ar" ? "ar-u-nu-latn" : "en-GB";
  const fmtDate = (d) =>
    d ? new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(d) : "—";
  const fmtTime = (d) =>
    d ? new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12: true }).format(d) : "—";

  const sameDay = fromDate && toDate && fmtDate(fromDate) === fmtDate(toDate);

  const DAY_NAMES_FULL = [t("daySun"), t("dayMon"), t("dayTue"), t("dayWed"), t("dayThu"), t("dayFri"), t("daySat")];
  const recurringType = registration?.recurringType ?? registration?.recurring_type ?? null;
  const recurringDays = registration?.recurringDays ?? registration?.recurring_days ?? null;
  const recurringTimeFrom = registration?.recurringTimeFrom ?? registration?.recurring_time_from ?? null;
  const recurringTimeTo   = registration?.recurringTimeTo   ?? registration?.recurring_time_to   ?? null;

  const recurringScheduleLabel = (() => {
    if (!recurringType) return null;
    const days = Array.isArray(recurringDays) && recurringDays.length
      ? recurringDays.map((d) => DAY_NAMES_FULL[d]).join(", ")
      : null;
    const time = recurringTimeFrom && recurringTimeTo ? `${recurringTimeFrom} – ${recurringTimeTo}` : null;
    return [days, time].filter(Boolean).join("  ·  ");
  })();

  const summaryRows = [
    {
      label: sameDay ? t("summaryVisitDate") : t("summaryFrom"),
      value: sameDay
        ? `${fmtDate(fromDate)}  ·  ${fmtTime(fromDate)} – ${fmtTime(toDate)}`
        : `${fmtDate(fromDate)}  ·  ${fmtTime(fromDate)}`,
    },
    ...(!sameDay ? [{ label: t("summaryTo"), value: `${fmtDate(toDate)}  ·  ${fmtTime(toDate)}` }] : []),
    ...(recurringScheduleLabel ? [{ label: t("recurringDays"), value: recurringScheduleLabel }] : []),
    ...(deptName ? [{ label: t("summaryDepartment"), value: translatedDynamic.dept || deptName }] : []),
    ...(purposeText ? [{ label: t("summaryPurpose"), value: translatedDynamic.purpose || purposeText }] : []),
  ];

  const summaryCardBorder = isDark ? alpha(SUMMARY_COLORS.white, 0.22) : alpha(SUMMARY_COLORS.primary, 0.14);
  const summarySectionBorder = isDark ? alpha(SUMMARY_COLORS.white, 0.18) : alpha(SUMMARY_COLORS.primary, 0.12);
  const summaryRowBorder = isDark ? alpha(SUMMARY_COLORS.white, 0.16) : alpha(SUMMARY_COLORS.primary, 0.1);
  const summaryHeaderBg = isDark
    ? SUMMARY_COLORS.white
    : `linear-gradient(135deg, ${SUMMARY_COLORS.primaryDeep} 0%, ${SUMMARY_COLORS.primary} 56%, ${SUMMARY_COLORS.edge} 100%)`;
  const summaryHeaderText = isDark ? SUMMARY_COLORS.primaryDark : SUMMARY_COLORS.white;
  const summaryHeaderMutedText = isDark ? alpha(SUMMARY_COLORS.primaryDark, 0.72) : alpha(SUMMARY_COLORS.white, 0.82);

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
      <Typography variant="caption" sx={{ color: SUMMARY_COLORS.inkSoft, ...(!isRtl && { textTransform: "uppercase", letterSpacing: 1.1 }) }}>
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={700} sx={{ color: SUMMARY_COLORS.ink, lineHeight: 1.45, mt: 0.45, wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  );

  return (
    <VisitorLayout justifyContent="center" mobileSubheading={t("summaryMobileSubheading")}>
      <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.35 }} style={{ width: "100%", direction: isRtl ? "rtl" : "ltr" }}>
        <Stack spacing={2.2}>

          <Stack alignItems="center" spacing={0.75}>
            <ICONS.checkCircle sx={{ fontSize: 48, color: "success.main" }} />
            <Typography variant="h6" fontWeight={800} sx={{ fontFamily: "'Comfortaa', cursive", display: { xs: "none", md: "block" } }}>
              {t("summaryTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 360 }}>
              {t("summaryDesc")}
            </Typography>
            <Box
              sx={{
                mt: 0.5,
                px: 1.75, py: 0.9, borderRadius: 999,
                display: "flex", alignItems: "center", gap: 0.75,
                bgcolor: (theme) => alpha(theme.palette.warning.main, 0.24),
                border: "1px solid",
                borderColor: (theme) => alpha(theme.palette.warning.main, 0.46),
              }}
            >
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "warning.main" }} />
              <Typography variant="caption" fontWeight={800} sx={{ color: isDark ? "#fef3c7" : "#7c2d12", textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.72rem" }}>
                {t("summaryStatus")}
              </Typography>
            </Box>
          </Stack>

          <Box ref={summaryRef} sx={{ width: "100%", maxWidth: 430, mx: "auto" }}>
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
                <Box sx={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", top: -72, right: -48, bgcolor: isDark ? alpha(SUMMARY_COLORS.primaryDark, 0.06) : alpha(SUMMARY_COLORS.white, 0.08) }} />
                <Box sx={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", bottom: -60, left: -28, bgcolor: isDark ? alpha(SUMMARY_COLORS.primaryDark, 0.04) : alpha(SUMMARY_COLORS.white, 0.05) }} />
                <Box sx={{ position: "relative", zIndex: 1 }}>
                  <Typography variant="h5" fontWeight={800} sx={{ color: summaryHeaderText, lineHeight: 1.15, wordBreak: "break-word", mb: 1 }}>
                    {visitorName}
                  </Typography>
                  {visitorIdentity?.value && (
                    <Stack useFlexGap direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25, flexWrap: "wrap" }}>
                      {visitorIdentity?.flagUrl && (
                        <Box component="img" src={visitorIdentity.flagUrl} alt={visitorIdentity.countryName} sx={{ width: 18, height: 12, objectFit: "cover", borderRadius: 0.4, border: `1px solid ${alpha(SUMMARY_COLORS.primaryDark, 0.16)}` }} />
                      )}
                      <Typography variant="caption" sx={{ color: summaryHeaderMutedText, wordBreak: "break-word" }}>
                        {visitorIdentity.label}: {visitorIdentity.value}
                      </Typography>
                    </Stack>
                  )}
                  {(visitorEmail || visitorPhone) && (
                    <Stack useFlexGap direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.85, flexWrap: "wrap", rowGap: 0.5 }}>
                      {visitorEmail && (
                        <>
                          <ICONS.email data-contact-icon="email" sx={{ fontSize: 13, color: summaryHeaderMutedText, flexShrink: 0 }} />
                          <Typography variant="caption" dir="ltr" sx={{ color: summaryHeaderMutedText, wordBreak: "break-all" }}>
                            {visitorEmail}
                          </Typography>
                        </>
                      )}
                      {visitorEmail && visitorPhone && (
                        <Typography variant="caption" sx={{ color: summaryHeaderMutedText }}>·</Typography>
                      )}
                      {visitorPhone && (
                        <>
                          <ICONS.phone data-contact-icon="phone" sx={{ fontSize: 13, color: summaryHeaderMutedText, flexShrink: 0 }} />
                          <Typography variant="caption" dir="ltr" sx={{ color: summaryHeaderMutedText, wordBreak: "break-all" }}>
                            {visitorPhone}
                          </Typography>
                        </>
                      )}
                    </Stack>
                  )}
                </Box>
              </Box>

              <Box sx={{ px: { xs: 2.5, sm: 3 }, py: 3 }}>
                <Box sx={{ mb: 2.25, borderRadius: 4, overflow: "hidden", bgcolor: SUMMARY_COLORS.panel, border: `1px solid ${summarySectionBorder}` }}>
                  {summaryRows.map((row, index) => (
                    <DetailRow key={row.label} label={row.label} value={row.value} index={index} />
                  ))}
                </Box>

                <Box sx={{ p: 2, borderRadius: "26px", background: SUMMARY_COLORS.panel, border: `1px solid ${summarySectionBorder}`, boxShadow: `0 14px 30px ${alpha(SUMMARY_COLORS.primaryDeep, 0.08)}` }}>
                  <Box sx={{ display: "flex", justifyContent: "center", mb: qrToken ? 1.5 : 0 }}>
                    <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: SUMMARY_COLORS.white, border: "1px solid #e4eef1" }}>
                      {/* Server-generated QR with logo (falls back to plain QR on failure) */}
                      {qrImageFailed ? (
                        <QRCodeCanvas value={qrToken || 'N/A'} size={170} bgColor={SUMMARY_COLORS.white} fgColor={SUMMARY_COLORS.primaryDark} includeMargin={false} />
                      ) : qrImageUrl ? (
                        <img
                          src={qrImageUrl}
                          alt="QR Code"
                          width={170}
                          height={170}
                          style={{ display: 'block', objectFit: 'contain', background: SUMMARY_COLORS.white }}
                        />
                      ) : (
                        <QRCodeCanvas value={qrToken || 'N/A'} size={170} bgColor={SUMMARY_COLORS.white} fgColor={SUMMARY_COLORS.primaryDark} includeMargin={false} />
                      )}
                    </Box>
                  </Box>
                  {qrToken && (
                    <Box sx={{ px: 1.75, py: 0.85, borderRadius: 999, display: "flex", justifyContent: "center" }}>
                      <Typography variant="caption" fontWeight={700} sx={{ color: isDark ? SUMMARY_COLORS.white : SUMMARY_COLORS.primaryDark, ...(!isRtl && { letterSpacing: 0.8 }), wordBreak: "break-all" }}>
                        {t("summaryToken")} {qrToken}
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" display="block" textAlign="center" sx={{ color: SUMMARY_COLORS.inkSoft }}>
                  {t("summaryPoweredBy")} {translatedDynamic.brand || hostBrandName}
                </Typography>
              </Box>
            </Paper>
          </Box>

          <Stack spacing={1.25}>
            <Button
              variant="contained"
              startIcon={<ICONS.home />}
              onClick={handleHome}
              sx={{ py: 1.5, borderRadius: 30, fontWeight: 700, width: "100%", ...getStartIconSpacing(isRtl ? "rtl" : "ltr") }}
            >
              {t("summaryBackHome")}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ICONS.download />}
              onClick={handleDownload}
              sx={{ py: 1.5, borderRadius: 30, fontWeight: 700, width: "100%", ...getStartIconSpacing(isRtl ? "rtl" : "ltr") }}
            >
              {t("summarySave")}
            </Button>
          </Stack>

        </Stack>
      </motion.div>
    </VisitorLayout>
  );
}
