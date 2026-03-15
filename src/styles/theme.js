import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: { main: "#128199" },
    secondary: { main: "#ffcc00" },
    background: { default: "#f9f9f9", paper: "#ffffff" },
    text: { primary: "#033649", secondary: "#555" },
  },

  typography: {
    fontFamily: "'Poppins', sans-serif",
    h1: {
      fontFamily: "'Comfortaa', cursive",
      fontSize: "3rem",
      fontWeight: "700",
    },
    h2: {
      fontFamily: "'Comfortaa', cursive",
      fontSize: "2rem",
      fontWeight: "700",
    },
    h3: {
      fontFamily: "'Comfortaa', cursive",
      fontSize: "1.75rem",
      fontWeight: "700",
    },
    h4: {
      fontFamily: "'Comfortaa', cursive",
      fontSize: "1.5rem",
      fontWeight: "700",
    },
    h5: {
      fontFamily: "'Comfortaa', cursive",
      fontSize: "1.3rem",
      fontWeight: "700",
    },
    h6: { fontFamily: "'Comfortaa', cursive", fontSize: "1.25rem" },
    body1: { fontSize: "1.075rem", fontFamily: "'Poppins', sans-serif" },
    body2: { fontSize: "0.95rem", fontFamily: "'Poppins', sans-serif" },
    subtitle1: { fontSize: "0.9rem", fontWeight: "600" },
    subtitle2: { fontSize: "0.8rem", fontWeight: "500" },
    button: { textTransform: "uppercase", fontWeight: "bold" },
  },

  shape: { borderRadius: 8 },

  components: {
    // === Buttons ===
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "999px",
          fontSize: "1rem",
          padding: "10px 20px",
          fontWeight: 600,
          textTransform: "none",
          transition: "all 0.3s ease",
        },

        // === CONTAINED VARIANTS ===
        containedPrimary: {
          backgroundColor: "#0077b6",
          color: "#ffffff",
          boxShadow: "0px 10px 32px rgba(0,0,0,0.1)",
          "&:hover": {
            transform: "scale(1.02)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
          },
        },
        containedSecondary: {
          backgroundColor: "#ffcc00",
          color: "#333333",
          boxShadow: "0px 10px 32px rgba(0,0,0,0.1)",
          "&:hover": {
            transform: "scale(1.02)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
          },
        },
        containedError: {
          backgroundColor: "#d32f2f",
          color: "#ffffff",
          boxShadow: "0px 10px 32px rgba(0,0,0,0.1)",
          "&:hover": {
            transform: "scale(1.02)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
          },
        },
        containedInfo: {
          backgroundColor: "#0288d1",
          color: "#ffffff",
          boxShadow: "0px 10px 32px rgba(0,0,0,0.1)",
          "&:hover": {
            backgroundColor: "#0277bd",
            transform: "scale(1.02)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
          },
        },

        // === OUTLINED VARIANTS ===
        outlinedPrimary: {
          color: "#0077b6",
          borderColor: "#0077b6",
          "&:hover": {
            backgroundColor: "rgba(0, 119, 182, 0.08)",
            transform: "scale(1.03)",
          },
        },
        outlinedSecondary: {
          color: "#ffcc00",
          borderColor: "#ffcc00",
          "&:hover": {
            backgroundColor: "rgba(255, 204, 0, 0.08)",
            transform: "scale(1.03)",
          },
        },
        outlinedError: {
          color: "#d32f2f",
          borderColor: "#d32f2f",
          "&:hover": {
            backgroundColor: "rgba(211, 47, 47, 0.08)",
            transform: "scale(1.03)",
          },
        },
        outlinedInfo: {
          color: "#0288d1",
          borderColor: "#0288d1",
          "&:hover": {
            backgroundColor: "rgba(2, 136, 209, 0.08)",
            transform: "scale(1.03)",
          },
        },
      },
    },

    // === Paper Variants ===
    MuiPaper: {
      styleOverrides: {
        root: {},
      },
      variants: [
        {
          props: { variant: "frosted" },
          style: {
            p: { xs: 3, sm: 4 },
            padding: "2rem",
            maxWidth: 800,
            width: "100%",
            textAlign: "center",
            backdropFilter: "blur(10px)",
            backgroundColor: "rgba(255,255,255,0.6)",
            borderRadius: 16,
            mt: { xs: 10, sm: "15vh" },
            mx: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          },
        },
      ],
    },

    // === Inputs Direction & Alignment ===
    MuiInputBase: {
      styleOverrides: {
        input: {
          userSelect: "text",
          WebkitUserSelect: "text",
          unicodeBidi: "plaintext",
          "&[dir='rtl']": {
            direction: "rtl !important",
            textAlign: "right !important",
          },
          "&[dir='ltr']": {
            direction: "ltr !important",
            textAlign: "left !important",
          },
          "&[dir='auto']": {
            textAlign: "start !important",
          },
        },
      },
    },

    // === Floating Label (RTL + Notched Outline Flip) ===
    MuiInputLabel: {
      styleOverrides: {
        root: {
          "&[dir='rtl'], [dir='rtl'] &": {
            right: 30,
            left: "auto",
            textAlign: "right",
            transformOrigin: "top right",
          },
          "&[dir='ltr'], [dir='ltr'] &": {
            right: "auto",
            textAlign: "left",
            transformOrigin: "top left",
          },
        },
      },
    },

    // === Outlined Input Fix for RTL Notch ===
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255,255,255,0.8)",
          borderRadius: "30px",
          overflow: "hidden",
          "&&.MuiOutlinedInput-multiline": { borderRadius: "16px" },

          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#128199",
            borderRadius: "inherit",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#0077b6",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#0077b6",
          },
        },
      },
    },

    // === Select Fields ===
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255,255,255,0.8)",
          borderRadius: "30px",
          overflow: "hidden",
          "&:focus": { backgroundColor: "rgba(255,255,255,0.9)" },
        },
        icon: { color: "#128199", right: 16 },
      },
    },
  },
});

export default theme;
