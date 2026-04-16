"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const VisitorContext = createContext();

const DEFAULT_VISITOR = {
  identity: "",
  userId: null,
  iso_code: "KW",
  fullName: "",
  email: "",
  phone: "",
  purposeOfVisit: "",
  dynamicFields: {},
};

const DEFAULT_FLOW = {
  ndaAccepted: false,
  otpVerified: false,
  isReturning: false,
  currentStep: "landing",
};

const DEFAULT_BOOKING = {
  date: null,
  timeFrom: "09:00",
  timeTo: "10:00",
};

function readSession(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export const VisitorProvider = ({ children }) => {
  const [visitorData, setVisitorDataRaw] = useState(() => readSession("vms_visitor", DEFAULT_VISITOR));
  const [flowState, setFlowStateRaw] = useState(() => readSession("vms_flow", DEFAULT_FLOW));
  const [bookingData, setBookingDataRaw] = useState(() => readSession("vms_booking", DEFAULT_BOOKING));

  // Wrap setters to also persist to sessionStorage
  const setVisitorData = (val) => {
    setVisitorDataRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      sessionStorage.setItem("vms_visitor", JSON.stringify(next));
      return next;
    });
  };

  const setFlowState = (val) => {
    setFlowStateRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      sessionStorage.setItem("vms_flow", JSON.stringify(next));
      return next;
    });
  };

  const setBookingData = (val) => {
    setBookingDataRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      sessionStorage.setItem("vms_booking", JSON.stringify(next));
      return next;
    });
  };

  const resetVisitorFlow = () => {
    sessionStorage.removeItem("vms_visitor");
    sessionStorage.removeItem("vms_flow");
    sessionStorage.removeItem("vms_booking");
    setVisitorDataRaw(DEFAULT_VISITOR);
    setFlowStateRaw(DEFAULT_FLOW);
    setBookingDataRaw(DEFAULT_BOOKING);
  };

  return (
    <VisitorContext.Provider
      value={{
        visitorData,
        setVisitorData,
        flowState,
        setFlowState,
        bookingData,
        setBookingData,
        resetVisitorFlow,
      }}
    >
      {children}
    </VisitorContext.Provider>
  );
};

export const useVisitor = () => {
  const context = useContext(VisitorContext);
  if (!context) {
    throw new Error("useVisitor must be used within a VisitorProvider");
  }
  return context;
};
