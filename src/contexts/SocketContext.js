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

  const canSeeNewRegistration = (registration, user) => {
    if (user?.role === "superadmin") return true;
    if (user?.role !== "admin") return false;

    const registrationDepartmentId =
      registration?.departmentId ||
      registration?.department_id ||
      registration?.department?.id;
    if (!registrationDepartmentId) return false;

    const departmentIds = Array.isArray(user?.departments)
      ? user.departments.map((dept) => dept.id).filter(Boolean)
      : [];

    return departmentIds.includes(registrationDepartmentId);
  };

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

    window.addEventListener("storage", syncToken);
    window.addEventListener("auth-storage-changed", syncToken);

    return () => {
      window.removeEventListener("storage", syncToken);
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

    newSocket.on("connect_error", (error) => {
      console.warn("Socket connection warning:", error?.message || error);
      setConnected(false);
    });

    newSocket.on("registration:new", (registration) => {
      const user = AuthStorage.getStoredUser();
      const isAuthorized = canSeeNewRegistration(registration, user);

      if (isAuthorized) {
        showMessageRef.current?.(
          `New registration: ${registration.user?.fullName || "Visitor"}`,
          "success",
        );
      }
    });

    newSocket.on("registration:updated", (registration) => {
      const user = AuthStorage.getStoredUser();
      if (shouldNotifyFinalApproval(registration, user)) {
        showMessageRef.current?.(
          `Dept approval received: ${registration.user?.fullName || "Visitor"} is awaiting final approval.`,
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
