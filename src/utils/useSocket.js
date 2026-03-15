import env from "@/config/env";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const WS_HOST = env.server.socket;
let socketInstance = null;

const useSocket = (events = {}) => {
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    if (!WS_HOST) {
      return;
    }

    if (!socketInstance) {
      socketInstance = io(WS_HOST, {
        transports: ["websocket"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
    }

    if (socketInstance.connected) {
      setConnected(true);
    }

    socketInstance.on("connect", () => {
      setConnected(true);
      setConnectionError(null);
    });

    socketInstance.on("connect_error", (err) => {
      setConnected(false);
      setConnectionError(err.message);
    });

    socketInstance.on("disconnect", (reason) => {
      console.warn("🔌 Socket disconnected:", reason);
      setConnected(false);
    });

    // Register dynamic events
    for (const [event, handler] of Object.entries(events)) {
      socketInstance.on(event, handler);
    }

    // Cleanup listeners on unmount or change
    return () => {
      for (const [event, handler] of Object.entries(events)) {
        socketInstance.off(event, handler);
      }
    };
  }, [events]);

  return {
    socket: socketInstance,
    connected,
    connectionError,
  };
};

export default useSocket;
