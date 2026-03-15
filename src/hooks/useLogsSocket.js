"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSocket from "@/utils/useSocket";

const FLUSH_DELAY_MS = 200;

export default function useLogsSocket() {
  const [latestLogs, setLatestLogs] = useState([]);
  const queueRef = useRef([]);
  const flushTimeoutRef = useRef(null);

  const flush = useCallback(() => {
    if (queueRef.current.length === 0) return;
    setLatestLogs([...queueRef.current]);
    queueRef.current = [];
  }, []);

  const events = useMemo(
    () => ({
      logCreated: (log) => {
        queueRef.current = [log, ...queueRef.current];
        if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = setTimeout(flush, FLUSH_DELAY_MS);
      },
    }),
    [flush]
  );

  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    };
  }, []);

  const clearLatestLogs = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    queueRef.current = [];
    setLatestLogs([]);
  }, []);

  const { socket, connected, connectionError } = useSocket(events);

  return { socket, connected, connectionError, latestLogs, clearLatestLogs };
}

