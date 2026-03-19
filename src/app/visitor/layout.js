import { Container } from "@mui/material";

export default function VisitorLayout({ children }) {
  return (
    <Container 
      maxWidth="lg" 
      sx={{ 
        py: { xs: 2, sm: 3 },
        minHeight: "calc(100vh - 70px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center"
      }}
    >
      {children}
    </Container>
  );
}
