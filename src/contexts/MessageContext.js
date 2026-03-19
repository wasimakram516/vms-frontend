"use client";

import React, { createContext, useState, useContext, useEffect } from "react";
import { Snackbar, Alert } from "@mui/material";
export const MessageContext = createContext();

let globalShowMessage = null;
export const showGlobalMessage = (text, severity = "error") => {
  if (typeof globalShowMessage === "function") {
    globalShowMessage(text, severity);
  }
};

export const MessageProvider = ({ children }) => {
  const [message, setMessage] = useState(null);

  const showMessage = (text, severity = "error") => {
    setMessage({ text, severity });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleClose = () => setMessage(null);
  useEffect(() => {
    globalShowMessage = showMessage;
  }, []);

  return (
    <MessageContext.Provider value={{ message, showMessage }}>
      {children}

      <Snackbar
        open={Boolean(message)}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        autoHideDuration={5000}
        sx={{ top: "60px !important" }}
      >
        {message && (
          <Alert
            variant="filled"
            severity={message.severity}
            onClose={handleClose}
          >
            {message.text || "An error occurred"}
          </Alert>
        )}
      </Snackbar>
    </MessageContext.Provider>
  );
};
export const useMessage = () => useContext(MessageContext);
