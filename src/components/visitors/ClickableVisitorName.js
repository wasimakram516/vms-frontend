"use client";

import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import ICONS from "@/utils/iconUtil";

/**
 * A visitor name that reads as clickable: plain text + trailing "view" icon,
 * hover color/underline + tooltip on desktop. No persistent underline, so the
 * UI stays clean.
 *
 * `sx` styles the outer wrapper (row layout: flex, width, …); typography props
 * (variant, fontWeight, …) style the inner name. The tooltip is anchored to the
 * inner name content, so it always appears above the name — never centered
 * over a stretched row.
 */
export default function ClickableVisitorName({
  name,
  visitorId,
  seed,
  onOpen,
  icon = true,
  tooltip = "View visitor details",
  truncate = false,
  sx = {},
  ...typographyProps
}) {
  const clickable = Boolean(visitorId && onOpen);

  const content = (
    <Typography
      component="span"
      onClick={
        clickable
          ? (e) => {
              e?.stopPropagation?.();
              onOpen(visitorId, seed);
            }
          : undefined
      }
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        cursor: clickable ? "pointer" : "default",
        ...(truncate ? { minWidth: 0 } : {}),
        ...(clickable
          ? {
              "&:hover": {
                color: "primary.main",
                "& .ClickableVisitorName-icon": {
                  color: "primary.main",
                  opacity: 1,
                },
              },
            }
          : {}),
      }}
      {...typographyProps}
    >
      <Typography
        component="span"
        variant="inherit"
        sx={{
          minWidth: 0,
          ...(truncate
            ? {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }
            : {}),
        }}
      >
        {name}
      </Typography>
      {icon && clickable && (
        <ICONS.view
          className="ClickableVisitorName-icon"
          sx={{ fontSize: 14, opacity: 0.55, flexShrink: 0 }}
        />
      )}
    </Typography>
  );

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        ...(truncate ? { minWidth: 0 } : {}),
        ...sx,
      }}
    >
      {clickable ? (
        <Tooltip title={tooltip} arrow placement="top">
          {content}
        </Tooltip>
      ) : (
        content
      )}
    </Box>
  );
}