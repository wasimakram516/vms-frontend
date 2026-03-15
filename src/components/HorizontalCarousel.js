"use client";

import { Box, Container } from "@mui/material";
import { keyframes } from "@mui/system";

const marqueeMany = keyframes`
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); } /* two identical halves */
`;

const marqueeFew = keyframes`
  0% { transform: translateX(100%); }   /* start off-screen on the right */
  100% { transform: translateX(-100%); }/* exit fully to the left */
`;

// Helper function to normalize URLs
const normalizeUrl = (url) => {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

function HorizontalCarousel({
  items = [],
  showBorders = false,
  maxWidth = "md",
  itemHeight = { xs: 28, sm: 36, md: 44 },
  itemMaxWidth = { xs: 120, sm: 160 },
  containerPadding = { xs: 1.5, md: 2 },
  itemPadding = { xs: 1.25, sm: 2 },
  pauseOnHover = true,
  reducedMotionSupport = true,
}) {
  // Filter items to only include those with logoUrl
  const validItems = Array.isArray(items)
    ? items.filter((item) => !!item?.logoUrl)
    : [];
  if (!validItems.length) return null;

  const isFew = validItems.length <= 5;

  // Calculate animation duration (slower speed)
  const duration = isFew
    ? Math.max(15, Math.min(20, validItems.length * 6))
    : 25;

  return (
    <Box
      sx={(theme) => ({
        ...(showBorders && {
          borderTop: `1px solid ${theme.palette.divider}`,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
        py: containerPadding,
        position: "relative",
        // Full viewport width lines above and below carousel
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100vw",
          height: "1px",
          backgroundColor: theme.palette.divider,
        },
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100vw",
          height: "1px",
          backgroundColor: theme.palette.divider,
        },
        ...(reducedMotionSupport && {
          "@media (prefers-reduced-motion: reduce)": {
            "& *": { animation: "none !important" },
          },
        }),
      })}
    >
      <Container
        maxWidth={maxWidth}
        sx={{
          overflow: "hidden",
          position: "relative",
          WebkitMaskImage:
            "linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,1) 20%, rgba(0,0,0,1) 80%, rgba(0,0,0,0))",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "100% 100%",
          maskImage:
            "linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,1) 20%, rgba(0,0,0,1) 80%, rgba(0,0,0,0))",
          maskRepeat: "no-repeat",
          maskSize: "100% 100%",
          width: "95vw",
          margin: "0 auto",
          px: 1,
        }}
      >
        <Box sx={{ direction: "ltr" }}>
          <Box
            sx={{
              display: "flex",
              flexWrap: "nowrap",
              width: "max-content",
              animation: `${isFew ? marqueeFew : marqueeMany
                } ${duration}s linear infinite`,
              ...(pauseOnHover && {
                "&:hover": { animationPlayState: "paused" },
              }),
            }}
          >
            {isFew ? (
              // FEW: single pass (starts at right, exits left)
              validItems.map((item, i) => (
                <CarouselItem
                  key={`few-${item._id || i}`}
                  item={item}
                  itemHeight={itemHeight}
                  itemMaxWidth={itemMaxWidth}
                  itemPadding={itemPadding}
                />
              ))
            ) : (
              // MANY: render two copies for seamless loop
              <>
                {validItems.map((item, i) => (
                  <CarouselItem
                    key={`a-${item._id || i}`}
                    item={item}
                    itemHeight={itemHeight}
                    itemMaxWidth={itemMaxWidth}
                    itemPadding={itemPadding}
                  />
                ))}
                {validItems.map((item, i) => (
                  <CarouselItem
                    key={`b-${item._id || i}`}
                    item={item}
                    itemHeight={itemHeight}
                    itemMaxWidth={itemMaxWidth}
                    itemPadding={itemPadding}
                  />
                ))}
              </>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

function CarouselItem({ item, itemHeight, itemMaxWidth, itemPadding }) {
  const clickable = !!item.website;
  const Wrapper = clickable ? "a" : "div";

  return (
    <Box
      component={Wrapper}
      href={clickable ? normalizeUrl(item.website) : undefined}
      target={clickable ? "_blank" : undefined}
      rel={clickable ? "noopener noreferrer" : undefined}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: itemPadding,
        opacity: 0.95,
        transition: "opacity .2s ease",
        textDecoration: "none",
        "&:hover": { opacity: 1 },
      }}
    >
      <Box
        component="img"
        src={item.logoUrl}
        alt={item.name || "carousel item"}
        sx={{
          height: itemHeight,
          maxWidth: itemMaxWidth,
          objectFit: "contain",
          display: "block",
        }}
      />
    </Box>
  );
}

export default HorizontalCarousel;
