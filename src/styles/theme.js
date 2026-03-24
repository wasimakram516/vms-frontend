import { createTheme } from "@mui/material/styles";

export const getTheme = (mode) => {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? "#ffffff" : "#000000",
        contrastText: isDark ? "#000000" : "#ffffff",
      },
      secondary: {
        main: isDark ? "#ffffff" : "#000000",
      },
      background: {
        default: isDark ? "#050505" : "#f8f9fa",
        paper: isDark ? "rgba(20, 20, 20, 0.7)" : "#ffffff",
      },
      text: {
        primary: isDark ? "#ffffff" : "#000000",
        secondary: isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)",
        disabled: isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.38)",
      },
      divider: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)",
    },

    typography: {
      fontFamily: "'Comfortaa', cursive, sans-serif",
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      button: { textTransform: "none", fontWeight: 600 },
    },

    shape: { borderRadius: 12 },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: "background-color 0.3s ease, color 0.3s ease",
            backgroundColor: isDark ? "#050505" : "#f8f9fa",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: "999px",
            padding: "8px 24px",
            fontWeight: 700,
            textTransform: "none",
            transition: "all 0.2s ease-in-out",
          },
          containedPrimary: {
            "&:hover": {
              backgroundColor: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)",
              transform: "translateY(-1px)",
            },
          },
          outlinedPrimary: {
            borderColor: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
            color: isDark ? "#ffffff" : "#000000",
            "&:hover": {
              borderColor: isDark ? "#ffffff" : "#000000",
              backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            ...(isDark && {
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            }),
            ...(!isDark && {
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
              border: "1px solid rgba(0, 0, 0, 0.05)",
            }),
          },
        },
        variants: [
          {
            props: { variant: "frosted" },
            style: {
              backdropFilter: "blur(16px)",
              backgroundColor: isDark ? "rgba(20, 20, 20, 0.6)" : "rgba(255, 255, 255, 0.8)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.08)",
              boxShadow: isDark ? "0 12px 40px rgba(0,0,0,0.6)" : "0 8px 32px rgba(0,0,0,0.1)",
              borderRadius: 24,
            },
          },
        ],
      },
      MuiTextField: {
        defaultProps: {
          variant: "outlined",
          size: "small",
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: "30px",
            backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
            transition: "all 0.2s ease",
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: isDark ? "#ffffff" : "#000000",
              borderWidth: "1px",
            },
            "& .MuiInputBase-input": {
              color: isDark ? "#ffffff" : "#000000",
            },
          },
          input: {
            color: isDark ? "#ffffff !important" : "#000000 !important",
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)",
            "&.Mui-focused": {
              color: isDark ? "#ffffff" : "#000000",
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            color: isDark ? "#ffffff" : "#000000",
          },
          input: {
            "&:-webkit-autofill": {
              WebkitBoxShadow: isDark ? "0 0 0 1000px rgba(5,5,5,1) inset !important" : "0 0 0 1000px #ffffff inset !important",
              WebkitTextFillColor: isDark ? "#ffffff !important" : "#000000 !important",
            },
          },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.3)",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "rgba(5, 5, 5, 0.8)" : "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(10px)",
            borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
            color: isDark ? "#ffffff" : "#000000",
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
          },
        },
      },
    },
  });
};

export default getTheme("light");
