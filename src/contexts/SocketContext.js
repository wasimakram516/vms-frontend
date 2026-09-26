"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { io } from "socket.io-client";
import { usePathname } from "next/navigation";
import * as AuthStorage from "@/utils/authStorage";
import { useMessage } from "./MessageContext";

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { showMessage } = useMessage();
  const pathname = usePathname();
  const showMessageRef = useRef(showMessage);
  const notifiedAdminApprovalRef = useRef(new Set());
  const [storedToken, setStoredToken] = useState(() =>
    AuthStorage.getStoredToken(),
  );

  const API_URL =
    process.env.NEXT_PUBLIC_WEBSOCKET_HOST || "http://localhost:4000";
  const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, "");
  const isRealtimeRoute =
    pathname?.startsWith("/cms") || pathname?.startsWith("/staff");

  const shouldNotifyFinalApproval = (registration, user) => {
    if (user?.role !== "superadmin") return false;
    if (registration?.status !== "admin_approved") return false;
    if (!registration?.id) return false;
    if (notifiedAdminApprovalRef.current.has(registration.id)) return false;

    notifiedAdminApprovalRef.current.add(registration.id);
    return true;
  };

  useEffect(() => {
    showMessageRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    const syncToken = () => setStoredToken(AuthStorage.getStoredToken());

    window.addEventListener("auth-storage-changed", syncToken);

    return () => {
      window.removeEventListener("auth-storage-changed", syncToken);
    };
  }, []);

  useEffect(() => {
    if (!storedToken || !isRealtimeRoute) {
      setSocket((current) => {
        current?.close();
        return null;
      });
      setConnected(false);
      return undefined;
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token: storedToken },
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      setConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnected(false);
    });

    // The server force-closes this socket the moment the session is revoked
    // (admin action, password change, deactivation) or the access token's
    // own expiry is reached — the socket is never left authenticated on a
    // stale credential. Log out immediately rather than silently retrying a
    // connection whose token the server will keep rejecting.
    const handleForcedDisconnect = (reason) => {
      showMessageRef.current?.(
        reason === "session:expired"
          ? "Your session has expired. Please log in again."
          : "Your session was ended by an administrator. Please log in again.",
        "warning",
      );
      AuthStorage.clearStoredAuthData();
      if (typeof window !== "undefined") {
        window.location.href = "/auth/login";
      }
    };
    newSocket.on("session:revoked", () => handleForcedDisconnect("session:revoked"));
    newSocket.on("session:expired", () => handleForcedDisconnect("session:expired"));

    newSocket.on("connect_error", (error) => {
      console.warn("Socket connection warning:", error?.message || error);
      setConnected(false);
    });

    newSocket.on("registration:new", (registration) => {
      const user = AuthStorage.getStoredUser();
      if (registration?.id && ["superadmin", "admin"].includes(user?.role)) {
        showMessageRef.current?.("A new registration is available.", "success");
      }
    });

    newSocket.on("registration:updated", (registration) => {
      const user = AuthStorage.getStoredUser();
      if (shouldNotifyFinalApproval(registration, user)) {
        showMessageRef.current?.(
          "A department-approved registration is awaiting final approval.",
          "info",
        );
      }
    });

    newSocket.on("overstay:alert", (data) => {
      const user = AuthStorage.getStoredUser();
      const { visitorName, minutesOverdue, reason, departmentId } = data || {};
      const isSuperAdmin = user?.role === "superadmin";
      const isGateStaff = user?.role === "staff" && user?.staffType === "gate";
      const isDeptAdmin = user?.role === "admin";

      const canSee =
        isSuperAdmin ||
        isGateStaff ||
        (isDeptAdmin &&
          departmentId &&
          Array.isArray(user?.departments) &&
          user.departments.some((d) => d.id === departmentId));

      if (!canSee) return;

      if (reason === "midnight") {
        showMessageRef.current?.(
          `${visitorName || "A visitor"} is still checked in past midnight — flagged as overstay.`,
          "warning",
        );
      } else if (minutesOverdue != null && minutesOverdue >= 0) {
        const h = Math.floor(minutesOverdue / 60);
        const m = minutesOverdue % 60;
        const overdue = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
        showMessageRef.current?.(
          `${visitorName || "A visitor"} is ${overdue} overstay — please check out.`,
          "warning",
        );
      }
    });

    setSocket(newSocket);

    return () => {
      setSocket((current) => (current === newSocket ? null : current));
      setConnected(false);
      newSocket.close();
    };
  }, [isRealtimeRoute, SOCKET_URL, storedToken]);

  const emit = useCallback(
    (event, data) => {
      if (socket) {
        socket.emit(event, data);
      }
    },
    [socket],
  );

  const on = useCallback(
    (event, callback) => {
      if (socket) {
        socket.on(event, callback);
        return () => socket.off(event, callback);
      }
    },
    [socket],
  );

  const value = {
    socket,
    connected,
    emit,
    on,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
