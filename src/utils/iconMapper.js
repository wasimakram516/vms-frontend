import ICONS from "@/utils/iconUtil";

export function getModuleIcon(iconKey, props = {}) {
  const IconComponent =
    ICONS[iconKey] || ICONS.module || ICONS.info; 
  return <IconComponent {...props} />;
}
