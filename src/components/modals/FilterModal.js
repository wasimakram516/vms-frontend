"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Slide,
  Typography,
  Box,
  Divider
} from "@mui/material";
import ICONS from "@/utils/iconUtil";
import { forwardRef } from "react";
import NoDataAvailable from "@/components/NoDataAvailable";

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const FilterModal = ({ open, onClose, title, children }) => {
  const hasChildren =
    !!children &&
    (!Array.isArray(children) ||
      children.some((c) => c !== null && c !== false));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      keepMounted
      fullWidth
      maxWidth="xs"
      TransitionComponent={Transition}
      PaperProps={{
        sx: {
          borderRadius: 4,
          variant: "frosted",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 3,
          py: 2,
        }}
      >
        <Typography variant="h6" fontWeight={800} component="span">
          {title || "Filters"}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <ICONS.close />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 3 }}>
        {hasChildren ? (
          children
        ) : (
          <NoDataAvailable
            title="No filters available"
            description="This view does not have any extra filters right now."
            compact
            minHeight={180}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FilterModal;
