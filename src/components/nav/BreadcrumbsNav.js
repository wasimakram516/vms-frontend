"use client";

import { Breadcrumbs, Link, Box } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";

import ICONS from "@/utils/iconUtil";
import { capitalize } from "@/utils/stringUtil";

const segmentMap = {
  dashboard: {
    label: "Dashboard",
    icon: <ICONS.home fontSize="small" sx={{ mr: 0.5 }} />,
  },
  registrations: {
    label: "Registrations",
    icon: <ICONS.appRegister fontSize="small" sx={{ mr: 0.5 }} />,
  },
  approvals: {
    label: "Approvals",
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
  "host-details": {
    label: "Host Details",
    icon: <ICONS.business fontSize="small" sx={{ mr: 0.5 }} />,
  },
  "nda-forms": {
    label: "NDA Forms",
    icon: <ICONS.description fontSize="small" sx={{ mr: 0.5 }} />,
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

  // Only render inside /cms
  if (!pathname.startsWith("/cms")) return null;

  // Don't render on the dashboard root itself
  if (pathname === "/cms" || pathname === "/cms/dashboard") return null;

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

  return (
    <Box sx={{ mb: 3 }}>
      <Breadcrumbs separator="›" aria-label="breadcrumb">
        <Link
          underline="hover"
          color="inherit"
          href="/cms/dashboard"
          onClick={(e) => {
            e.preventDefault();
            router.push("/cms/dashboard");
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <ICONS.home fontSize="small" sx={{ mr: 0.5 }} />
            Dashboard
          </Box>
        </Link>

        {paths.map((p, i) => {
          const segment = formatSegment(p.segment);
          const isLast = i === paths.length - 1;

          return isLast ? (
            <Box
              key={i}
              sx={{
                display: "flex",
                alignItems: "center",
                color: "text.primary",
                fontWeight: "bold",
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
