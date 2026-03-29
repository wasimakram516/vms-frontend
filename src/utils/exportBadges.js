import { pdf, Document } from "@react-pdf/renderer";
import QRCode from "qrcode";
import BadgePDF from "@/components/badges/BadgePDF";

/**
 * Exports all badges to a multi-page PDF in browser.
 * Each badge = one Page from BadgePDF.
 * @param {Array} registrations - Array of registration objects with user data joined
 * @param {Object} badgeTemplate - Badge template with layout_json
 * @param {String} filename - Optional custom filename for the PDF
 */
export async function exportAllBadges(registrations = [], badgeTemplate, filename) {
  if (!registrations?.length) return;

  // 1. Pre-generate QR code data URLs
  const regs = await Promise.all(
    registrations.map(async (r) => ({
      ...r,
      qrCodeDataUrl: await QRCode.toDataURL(r.qr_token || "N/A"),
    }))
  );


  // 2. Build the document element (detached from current React tree)
  const doc = (
    <Document>
      {regs.map((r) => {
        // Extract field values from registration_field_values if available
        const fieldValues = r.fieldValues || {};

        const data = {
          fullName:
            fieldValues["Full Name"] ||
            fieldValues["full_name"] ||
            fieldValues["name"] ||
            r.full_name ||
            r.user?.full_name ||
            "Unnamed Visitor",

          email:
            fieldValues["Email"] ||
            fieldValues["email"] ||
            r.email ||
            r.user?.email ||
            "",

          phone:
            fieldValues["Phone"] ||
            fieldValues["phone"] ||
            r.phone ||
            r.user?.phone ||
            "",

          company:
            fieldValues["Company"] ||
            fieldValues["company_name"] ||
            fieldValues["organization"] ||
            r.company_name ||
            r.user?.company_name ||
            "",

          purposeOfVisit:
            fieldValues["Purpose"] ||
            fieldValues["purpose_of_visit"] ||
            r.purpose_of_visit ||
            "",

          hostName: r.host_name || "",
          requestedDate: r.requested_date || r.requestedDateFrom || "",
          requestedTimeFrom: r.requested_time_from || r.requestedTimeFrom || "",
          requestedTimeTo: r.requested_time_to || r.requestedTimeTo || "",

          badgeIdentifier: r.badge_identifier || "",

          token: r.qr_token || "",
          showQrOnBadge: true,
          fieldValues: fieldValues,
        };
        return (
          <BadgePDF
            key={r.id || r._id}
            data={data}
            qrCodeDataUrl={r.qrCodeDataUrl}
            customizations={badgeTemplate?.layoutJson}
            single={false}
          />
        );
      })}
    </Document>
  );

  // 3. Create a fresh PDF instance
  const instance = pdf(doc);

  // 4. Render to blob safely
  const blob = await instance.toBlob();

  // 5. Trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `badges_${new Date().toISOString().split("T")[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
