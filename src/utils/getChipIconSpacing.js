// MUI Chip icon margins are hardcoded for LTR (ml: 5px / mr: -6px) and the app
// flips direction via the dir attribute only, so mirror them manually in RTL.
// Spread into a container sx — applies to all descendant chips with icons.
export default function getChipIconSpacing(dir) {
  if (dir !== "rtl") return {};
  return {
    "& .MuiChip-icon": {
      marginLeft: "-6px",
      marginRight: "5px",
    },
    "& .MuiChip-sizeSmall .MuiChip-icon": {
      marginLeft: "-4px",
      marginRight: "4px",
    },
  };
}
