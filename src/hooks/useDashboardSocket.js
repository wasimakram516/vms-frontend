import { useState, useEffect } from "react";
import useSocket from "@/utils/useSocket";

/**
 * Hook for dashboard metrics updates via socket
 */
const useDashboardSocket = ({ onMetricsUpdate }) => {
  const [lastUpdate, setLastUpdate] = useState(null);

  const { socket, connected, connectionError } = useSocket({
    metricsUpdated: (metrics) => {
      console.log("📊 Received metricsUpdated:", metrics);
      setLastUpdate(new Date());
      if (onMetricsUpdate) onMetricsUpdate(metrics);
    },
    metricsError: (msg) => {
      console.error("❌ Metrics error:", msg);
    },
  });

  return {
    socket,
    connected,
    connectionError,
    lastUpdate,
  };
};

export default useDashboardSocket;
