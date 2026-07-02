"use client";

import { Breadcrumbs, Link, Box } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";

import ICONS from "@/utils/iconUtil";
import { capitalize } from "@/utils/stringUtil";
import { useAuth } from "@/contexts/AuthContext";

const segmentMap = {
  dashboard: {
    label: "Dashboard",
    icon: <ICONS.home fontSize="small" sx={{ mr: 0.5 }} />,
  },
  visitors: {
    label: "Visitors",
    icon: <ICONS.badge fontSize="small" sx={{ mr: 0.5 }} />,
  },
  visits: {
    label: "Visits",
    icon: <ICONS.checkin fontSize="small" sx={{ mr: 0.5 }} />,
  },
  users: {
    label: "Users",
    icon: <ICONS.peopleAlt fontSize="small" sx={{ mr: 0.5 }} />,
  },
  fields: {
    label: "Dynamic Fields",
    icon: <ICONS.form fontSize="small" sx={{ mr: 0.5 }} />,
  },
  settings: {
    label: "Settings",
    icon: <ICONS.settings fontSize="small" sx={{ mr: 0.5 }} />,
  },
  "nda-templates": {
    label: "NDA Templates",
    icon: <ICONS.description fontSize="small" sx={{ mr: 0.5 }} />,
  },
  "global-settings": {
    label: "Global Settings",
    icon: <ICONS.business fontSize="small" sx={{ mr: 0.5 }} />,
  },
  "nda-forms": {
    label: "NDA Forms",
    icon: <ICONS.description fontSize="small" sx={{ mr: 0.5 }} />,
  },
  analytics: {
    label: "Analytics",
    icon: <ICONS.insights fontSize="small" sx={{ mr: 0.5 }} />,
  },
  kitchen: {
    label: "Kitchen Orders",
    icon: <ICONS.diningTable fontSize="small" sx={{ mr: 0.5 }} />,
  },
  departments: {
    label: "Departments",
    icon: <ICONS.apartment fontSize="small" sx={{ mr: 0.5 }} />,
  },
  "access-levels": {
    label: "Access Levels",
    icon: <ICONS.key fontSize="small" sx={{ mr: 0.5 }} />,
  },
  "kitchen-menu": {
    label: "Kitchen Menu",
    icon: <ICONS.diningTable fontSize="small" sx={{ mr: 0.5 }} />,
  },
  "badge-customization": {
    label: "Badge Customization",
    icon: <ICONS.badge fontSize="small" sx={{ mr: 0.5 }} />,
  },
  "access-control": {
    label: "Access Control",
    icon: <ICONS.security fontSize="small" sx={{ mr: 0.5 }} />,
  },
  permissions: {
    label: "Permissions",
    icon: <ICONS.key fontSize="small" sx={{ mr: 0.5 }} />,
  },
  "role-permissions": {
    label: "Role Permissions",
    icon: <ICONS.badge fontSize="small" sx={{ mr: 0.5 }} />,
  },
};

const formatSegment = (seg) => {
  if (segmentMap[seg]) {
    const { icon, label } = segmentMap[seg];
    return (
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {icon}
        <span>{label}</span>
      </Box>
    );
  }
  return capitalize(seg.replace(/-/g, " "));
};

export default function BreadcrumbsNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const isDev = user?.role === "dev";
  const isKitchenAdmin = user?.role === "admin" && (user?.adminType || "departmental") === "kitchen";
  const dashboardHref = isDev ? "/cms/settings" : isKitchenAdmin ? "/cms/kitchen" : "/cms/dashboard";

  // Only render inside /cms
  if (!pathname.startsWith("/cms")) return null;

  // Don't render on the home root for the current role
  if (pathname === "/cms" || pathname === dashboardHref) return null;

  const segments = pathname
    .split("/")
    .filter((seg) => seg && seg !== "cms" && seg !== "");

  const paths = segments.map((seg, i) => {
    // Dynamic slugs (IDs, etc. — not in segmentMap) link to their parent
    if (!segmentMap[seg]) {
      return {
        segment: seg,
        href: "/cms/" + segments.slice(0, i).join("/"),
      };
    }
    return {
      segment: seg,
      href: "/cms/" + segments.slice(0, i + 1).join("/"),
    };
  });

  const kitchenAdminAllowedPaths = ["/cms/kitchen", "/cms/settings", "/cms/settings/kitchen-menu"];

  return (
    <Box sx={{ mb: 3 }}>
      <Breadcrumbs separator="›" aria-label="breadcrumb">
        {!isKitchenAdmin && (
        <Link
          underline="hover"
          color="inherit"
          href={dashboardHref}
          onClick={(e) => {
            e.preventDefault();
            router.push(dashboardHref);
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <ICONS.home fontSize="small" sx={{ mr: 0.5 }} />
            Dashboard
          </Box>
        </Link>
        )}

        {paths.map((p, i) => {
          const segment = formatSegment(p.segment);
          const isLast = i === paths.length - 1;

          // For Kitchen Admins, don't make intermediate crumbs clickable if they can't access that path
          const isBlocked = isKitchenAdmin && !kitchenAdminAllowedPaths.some(allowed => p.href === allowed || p.href.startsWith(allowed));

          return isLast || isBlocked ? (
            <Box
              key={i}
              sx={{
                display: "flex",
                alignItems: "center",
                color: isLast ? "text.primary" : "text.secondary",
                fontWeight: isLast ? "bold" : 400,
              }}
            >
              {segment}
            </Box>
          ) : (
            <Link
              key={i}
              underline="hover"
              color="inherit"
              href={p.href}
              onClick={(e) => {
                e.preventDefault();
                router.push(p.href);
              }}
              sx={{ display: "flex", alignItems: "center" }}
            >
              {segment}
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
}
