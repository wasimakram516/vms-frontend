import { Container } from "@mui/material";

export default function RegisterLayout({ children }) {
  return (
    <Container 
      maxWidth="lg" 
      sx={{ 
        py: { xs: 4, sm: 6 },
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {children}
    </Container>
  );
}