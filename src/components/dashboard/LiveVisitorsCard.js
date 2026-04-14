"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Stack,
  Chip,
  Button,
  Skeleton,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import { io } from "socket.io-client";
import AppCard from "@/components/cards/AppCard";
import { useColorMode } from "@/contexts/ThemeContext";
import { getLiveVisitors } from "@/services/dashboardService";
import LiveVisitorsModal from "./LiveVisitorsModal";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:4000";

export default function LiveVisitorsCard() {
  const { mode } = useColorMode();
  const isDark = mode === "dark";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const socketRef = useRef(null);

  const fetchLive = useCallback(async ({ silent = false } = {}) => {
    const showInitialLoading = !hasLoadedOnce && !silent;
    if (showInitialLoading) setLoading(true);

    const result = await getLiveVisitors();
    if (result && !result.error) {
      setData(result);
      setHasLoadedOnce(true);
    }
    if (showInitialLoading) setLoading(false);
  }, [hasLoadedOnce]);

  // Initial fetch
  useEffect(() => {
    fetchLive();
  }, [fetchLive]);

  // Socket subscription 
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("dashboard:live-update", () => {
      fetchLive({ silent: true });
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchLive]);

  const total = data?.total ?? 0;

  // Top 4 groups by department for the mini-chips preview
  const previewGroups = (data?.byDepartment ?? []).slice(0, 4);

  return (
    <>
      <AppCard variant="frosted" sx={{ p: 2.5 }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2.5,
                bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                display: "flex",
              }}
            >
              <PeopleAltIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              Live Visitors
            </Typography>
          </Stack>

          {/* Pulsing live badge */}
          <Chip
            icon={
              <FiberManualRecordIcon
                sx={{
                  fontSize: "10px !important",
                  color: "#4CAF50 !important",
                  animation: "pulse 2s infinite",
                  "@keyframes pulse": {
                    "0%, 100%": { opacity: 1 },
                    "50%": { opacity: 0.4 },
                  },
                }}
              />
            }
            label={loading ? "—" : `${total} checked in`}
            size="small"
            sx={{
              height: 22,
              fontSize: "0.72rem",
              fontWeight: 700,
              bgcolor: isDark ? "rgba(76,175,80,0.15)" : "rgba(76,175,80,0.12)",
              color: "#4CAF50",
              border: "1px solid rgba(76,175,80,0.3)",
              "& .MuiChip-icon": { ml: 0.5 },
            }}
          />
        </Stack>

        {/* Big count */}
        {loading ? (
          <Skeleton variant="text" width={60} height={56} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={total}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
            >
              <Typography variant="h4" fontWeight={800} mb={0.5}>
                {total}
              </Typography>
            </motion.div>
          </AnimatePresence>
        )}

        <Typography variant="body2" color="text.secondary" fontWeight={600} mb={1.5}>
          Currently Checked In
        </Typography>

        {/* Mini department breakdown chips */}
        {loading ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
            {[80, 60, 70, 55].map((w, i) => (
              <Skeleton key={i} variant="rounded" width={w} height={22} sx={{ borderRadius: 10 }} />
            ))}
          </Stack>
        ) : previewGroups.length > 0 ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.8} mb={2}>
            {previewGroups.map((g) => (
              <Chip
                key={g.id ?? g.name}
                label={`${g.name} · ${g.count}`}
                size="small"
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  height: 22,
                  bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                  color: "text.secondary",
                  border: "none",
                }}
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.disabled" display="block" mb={2}>
            No visitors checked in
          </Typography>
        )}

        {/* View Details button */}
        <Button
          fullWidth
          variant="outlined"
          startIcon={<OpenInFullIcon />}
          onClick={() => setModalOpen(true)}
          disabled={loading || total === 0}
          sx={{ borderRadius: 3, px: 3, py: 1, fontWeight: 700 }}
        >
          View Details
        </Button>
      </AppCard>

      <LiveVisitorsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={data}
      />
    </>
  );
}
