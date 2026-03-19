import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Slide,
} from "@mui/material";
import ICONS from "@/utils/iconUtil";
import { forwardRef } from "react";
import EmptyBusinessState from "../EmptyBusinessState";

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="left" ref={ref} {...props} />;
});

const FilterDialog = ({ open, onClose, title, children }) => {
  const dir = "ltr";

  const hasChildren =
    !!children &&
    (!Array.isArray(children) ||
      children.some((c) => c !== null && c !== false));

  return (
    <Dialog
      dir={dir}
      open={open}
      onClose={onClose}
      keepMounted
      fullWidth
      maxWidth="sm"
      TransitionComponent={Transition}
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: "40vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pb: 0,
        }}
      >
        {title}
        <IconButton onClick={onClose}>
          <ICONS.close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2, flex: 1 }}>
        {hasChildren ? children : <EmptyBusinessState />}
      </DialogContent>
    </Dialog>
  );
};

export default FilterDialog;
