export default function getStartIconSpacing(dir, options = {}) {
  const { spacing = "0.5rem", includeEnd = false, endSpacing } = options;
  const resolvedEndSpacing = endSpacing ?? spacing;

  return {
    "& .MuiButton-startIcon": {
      marginRight: dir === "rtl" ? 0 : spacing,
      marginLeft: dir === "rtl" ? spacing : 0,
    },
    ...(includeEnd && {
      "& .MuiButton-endIcon": {
        marginRight: dir === "rtl" ? resolvedEndSpacing : 0,
        marginLeft: dir === "rtl" ? 0 : resolvedEndSpacing,
      },
    }),
  };
}
