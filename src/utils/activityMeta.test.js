import { describe, it, expect, vi } from "vitest";

// activityMeta pulls the full MUI icon map via iconUtil (~900 files). Mocking
// it keeps the test to the metadata mapping alone and avoids EMFILE on Windows.
vi.mock("@/utils/iconUtil", () => ({
  default: new Proxy(
    {},
    { get: () => "icon-component" },
  ),
}));

import {
  ACTIVITY_TYPES,
  ACTIVITY_ICONS,
  ACTIVITY_LABELS,
  ACTIVITY_STATUS,
  getActivityIcon,
  getActivityLabel,
  getActivityStatus,
} from "./activityMeta";

describe("activityMeta", () => {
  it("defines the full activity type list including batch exports", () => {
    expect(ACTIVITY_TYPES).toContain("submitted");
    expect(ACTIVITY_TYPES).toContain("checked_in");
    expect(ACTIVITY_TYPES).toContain("sla_escalation");
    expect(ACTIVITY_TYPES).toContain("badges_exported");
    expect(ACTIVITY_TYPES).toContain("visits_exported");
    expect(ACTIVITY_TYPES).toContain("visit_history_exported");
    expect(ACTIVITY_TYPES).toContain("internal_note");
  });

  it("gives a label, status and icon for every registered type", () => {
    for (const type of ACTIVITY_TYPES) {
      expect(getActivityLabel(type), `label for ${type}`).toBeTruthy();
      expect(getActivityStatus(type), `status for ${type}`).toBeTruthy();
      expect(getActivityIcon(type), `icon for ${type}`).toBeTruthy();
    }
  });

  it("types without an explicit status fall back to default", () => {
    // nda_signed / qr_generated / scanned / badge_printed are intentionally
    // absent from ACTIVITY_STATUS and rely on the getter fallback.
    for (const type of ["nda_signed", "qr_generated", "scanned", "badge_printed"]) {
      expect(ACTIVITY_STATUS[type]).toBeUndefined();
      expect(getActivityStatus(type)).toBe("default");
    }
    // internal_note is registered explicitly (staff-private note events) and
    // therefore must NOT fall back.
    expect(ACTIVITY_STATUS.internal_note).toBeDefined();
    expect(getActivityStatus("internal_note")).toBe("info");
  });

  it("labels batch export types distinctly", () => {
    expect(getActivityLabel("badges_exported")).toBe("Badges Exported");
    expect(getActivityLabel("visits_exported")).toBe("Visits Exported");
    expect(getActivityLabel("badge_printed")).toBe("Badge Printed");
  });

  it("returns engineering statuses for batch exports", () => {
    expect(getActivityStatus("badges_exported")).toBe("info");
    expect(getActivityStatus("visits_exported")).toBe("info");
  });

  it("falls back to the raw type for unknown labels", () => {
    expect(getActivityLabel("totally_unknown_type")).toBe("totally_unknown_type");
  });

  it("falls back to default status/icon for unknown types", () => {
    expect(getActivityStatus("totally_unknown_type")).toBe("default");
    expect(getActivityIcon("totally_unknown_type")).toBeTruthy();
  });

  it("labels/statuses known events correctly", () => {
    expect(getActivityLabel("checked_in")).toBe("Checked In");
    expect(getActivityLabel("overstay_detected")).toBe("Overstay Detected");
    expect(getActivityStatus("checked_in")).toBe("success");
    expect(getActivityStatus("rejected")).toBe("error");
    expect(getActivityStatus("overstay_detected")).toBe("error");
  });

  it("registers internal-note activity metadata (staff private notes)", () => {
    expect(ACTIVITY_ICONS.internal_note).toBeTruthy();
    expect(ACTIVITY_LABELS.internal_note).toBe("Internal Note");
    expect(ACTIVITY_STATUS.internal_note).toBe("info");
    expect(getActivityIcon("internal_note")).toBeTruthy();
    expect(getActivityLabel("internal_note")).toBe("Internal Note");
    expect(getActivityStatus("internal_note")).toBe("info");
  });
});