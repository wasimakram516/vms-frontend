"use client";

import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
  Divider,
  Link as MuiLink,
  useTheme,
} from "@mui/material";
import {
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  LinkedIn as LinkedInIcon,
  Language as LanguageIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useGlobalConfig } from "@/contexts/GlobalConfigContext";

export default function GeneralInfo({
  title,
  subtitle,
  description,
  ctaText,
  ctaHref,
  moduleIcon: Icon,
}) {
  const router = useRouter();
  const theme = useTheme();
  const { globalConfig } = useGlobalConfig();
  const dir = "ltr";
  const align = "left";

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        px: 2,
        py: 4,
        textAlign: align,
      }}
    >
      <Container maxWidth="md" sx={{ textAlign: "center" }} dir={dir}>
        {Icon && (
           <Box
             sx={{
               bgcolor: `${theme.palette.primary.main}20`,
               p: 4,
               borderRadius: "50%",
               display: "inline-flex",
               alignItems: "center",
               justifyContent: "center",
               mb: 3,
             }}
           >
             {typeof Icon === 'function' ? (
               <Box sx={{ 
                 fontSize: 60, 
                 color: "primary.main",
                 display: "flex",
                 alignItems: "center",
                 justifyContent: "center",
                 '& svg': {
                   fontSize: 'inherit',
                   width: '1em',
                   height: '1em',
                   display: 'block'
                 }
               }}>
                 {Icon()}
               </Box>
             ) : (
               <Icon sx={{ fontSize: 60, color: "primary.main" }} />
             )}
          </Box>
        )}

        <Typography variant="h3" fontWeight="bold" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {subtitle}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mt: 3 }}>
          {description}
        </Typography>

        {ctaText && ctaHref && (
          <Button
            variant="contained"
            size="large"
            sx={{ mt: 4 }}
            onClick={() => router.push(ctaHref)}
          >
            {ctaText}
          </Button>
        )}

        <Divider sx={{ my: 6 }} />
      </Container>

      {globalConfig && (
        <Stack spacing={1} mt={6} direction="column" alignItems="center">
          {globalConfig?.companyLogoUrl && (
            <Box
              component="img"
              src={globalConfig.companyLogoUrl}
              alt="Company Logo"
              sx={{ height: 64, mt: 6, opacity: 0.7 }}
            />
          )}

          {(globalConfig?.contact?.email || globalConfig?.contact?.phone) && (
            <Stack
              spacing={1}
              direction="row"
              alignItems="center"
              flexWrap="wrap"
              justifyContent="center"
              useFlexGap
            >
              {globalConfig?.contact?.email && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <EmailIcon fontSize="small" />
                  <Typography variant="body2">
                    {globalConfig.contact.email}
                  </Typography>
                </Stack>
              )}
              {globalConfig?.contact?.phone && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <PhoneIcon fontSize="small" />
                  <Typography variant="body2">
                    {globalConfig.contact.phone}
                  </Typography>
                </Stack>
              )}
            </Stack>
          )}

          {(globalConfig?.socialLinks?.facebook ||
            globalConfig?.socialLinks?.instagram ||
            globalConfig?.socialLinks?.linkedin ||
            globalConfig?.socialLinks?.website) && (
            <Stack direction="row" spacing={2} mt={1}>
              {globalConfig?.socialLinks?.facebook && (
                <MuiLink
                  href={globalConfig.socialLinks.facebook}
                  target="_blank"
                  color="inherit"
                >
                  <FacebookIcon />
                </MuiLink>
              )}
              {globalConfig?.socialLinks?.instagram && (
                <MuiLink
                  href={globalConfig.socialLinks.instagram}
                  target="_blank"
                  color="inherit"
                >
                  <InstagramIcon />
                </MuiLink>
              )}
              {globalConfig?.socialLinks?.linkedin && (
                <MuiLink
                  href={globalConfig.socialLinks.linkedin}
                  target="_blank"
                  color="inherit"
                >
                  <LinkedInIcon />
                </MuiLink>
              )}
              {globalConfig?.socialLinks?.website && (
                <MuiLink
                  href={globalConfig.socialLinks.website}
                  target="_blank"
                  color="inherit"
                >
                  <LanguageIcon />
                </MuiLink>
              )}
            </Stack>
          )}
        </Stack>
      )}
    </Box>
  );
}
