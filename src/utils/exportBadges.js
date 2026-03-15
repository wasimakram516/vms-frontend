import { pdf, Document } from "@react-pdf/renderer";
import QRCode from "qrcode";
import BadgePDF from "@/components/badges/BadgePDF";

/**
 * Exports all badges to a multi-page PDF in browser.
 * Each badge = one Page from BadgePDF.
 */
export async function exportAllBadges(registrations = [], eventDetails) {
  if (!registrations?.length) return;

  // 1. Pre-generate QR code data URLs
  const regs = await Promise.all(
    registrations.map(async (r) => ({
      ...r,
      qrCodeDataUrl: await QRCode.toDataURL(r.token || ""),
    }))
  );

  // 2. Build the document element (detached from current React tree)
  const doc = (
    <Document>
      {regs.map((r) => {
        const data = {
          fullName:
            r.customFields?.["Full Name"] ||
            r.customFields?.["fullName"] ||
            r.customFields?.["Name"] ||
            r.customFields?.["name"] ||
            (
              (r.customFields?.["First Name"] ||
                r.customFields?.["firstName"] ||
                r.customFields?.["FirstName"] ||
                "") +
              " " +
              (r.customFields?.["Last Name"] ||
                r.customFields?.["lastName"] ||
                r.customFields?.["LastName"] ||
                "")
            ).trim() ||
            r.fullName ||
            "Unnamed Visitor",

          company:
            r.customFields?.["Company"] ||
            r.customFields?.["Institution"] ||
            r.customFields?.["Organization"] ||
            r.customFields?.["organization"] ||
            r.customFields?.["institution"] ||
            r.company ||
            "",

          // title:
          //   r.customFields?.["Title"] ||
          //   r.customFields?.["Position"] ||
          //   r.customFields?.["position"] ||
          //   r.title ||
          //   "",
          badgeIdentifier: r.badgeIdentifier || "",

          token: r.token,
          showQrOnBadge: eventDetails?.showQrOnBadge ?? true,
          customFields: r.customFields || {},
        };
        return (
          <BadgePDF
            key={r._id}
            data={data}
            qrCodeDataUrl={r.qrCodeDataUrl}
            customizations={eventDetails?.customizations}
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
  link.download = `${eventDetails?.slug || "event"}_badges.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
