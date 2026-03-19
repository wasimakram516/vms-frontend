"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const VisitorContext = createContext();

export const VisitorProvider = ({ children }) => {
  const [visitorData, setVisitorData] = useState({
    identity: "", // email or phone
    iso_code: "KW",
    fullName: "",
    email: "",
    phone: "",
    purposeOfVisit: "",
    dynamicFields: {},
  });

  const [flowState, setFlowState] = useState({
    ndaAccepted: false,
    otpVerified: false,
    isReturning: false,
    currentStep: "landing",
  });

  const [bookingData, setBookingData] = useState({
    date: null,
    timeFrom: "09:00",
    timeTo: "10:00",
  });

  const resetVisitorFlow = () => {
    setVisitorData({
      identity: "",
      iso_code: "KW",
      fullName: "",
      email: "",
      phone: "",
      purposeOfVisit: "",
      dynamicFields: {},
    });
    setFlowState({
      ndaAccepted: false,
      otpVerified: false,
      isReturning: false,
      currentStep: "landing",
    });
    setBookingData({
      date: null,
      timeFrom: "09:00",
      timeTo: "10:00",
    });
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
