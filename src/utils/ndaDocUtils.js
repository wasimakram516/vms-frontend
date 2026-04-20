function extractSegments(el, defaultFontSize = null) {
  const segs = [];

  function cssColorToHex(style) {
    const hexM = style.match(/color\s*:\s*(#[0-9a-fA-F]{3,6})/i);
    if (hexM) return hexM[1];
    // Matches both rgb() and rgba() — alpha channel is discarded.
    const rgbM = style.match(/color\s*:\s*rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbM) {
      const r = parseInt(rgbM[1]).toString(16).padStart(2, "0");
      const g = parseInt(rgbM[2]).toString(16).padStart(2, "0");
      const b = parseInt(rgbM[3]).toString(16).padStart(2, "0");
      return `#${r}${g}${b}`;
    }
    return null;
  }

  function walk(node, bold, italic, underline, strike, color, fontSize) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent
        .replace(/\u200B/g, "")
        .replace(/\u00A0/g, " ");
      if (text) {
        const seg = { text };
        if (bold) seg.bold = true;
        if (italic) seg.italic = true;
        if (underline) seg.underline = true;
        if (strike) seg.strike = true;
        if (color) seg.color = color;
        if (fontSize != null) seg.fontSize = Math.round(fontSize);
        segs.push(seg);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();
    const style = node.style?.cssText || "";

    const newBold =
      bold ||
      tag === "b" ||
      tag === "strong" ||
      /font-weight\s*:\s*(bold|700)/i.test(style);
    const newItalic =
      italic ||
      tag === "em" ||
      tag === "i" ||
      /font-style\s*:\s*italic/i.test(style);
    const newUnderline =
      underline ||
      tag === "u" ||
      /text-decoration[^;]*underline/i.test(style);
    const newStrike =
      strike ||
      tag === "s" ||
      tag === "strike" ||
      /text-decoration[^;]*line-through/i.test(style);

    let newColor = color;
    if (tag === "font") {
      const attr = node.getAttribute("color");
      if (attr) newColor = attr;
    } else {
      const parsed = cssColorToHex(style);
      if (parsed) newColor = parsed;
    }

    let newFontSize = fontSize;
    const sizeM = style.match(/font-size\s*:\s*([\d.]+)px/i);
    if (sizeM) newFontSize = parseFloat(sizeM[1]);

    for (const child of node.childNodes) {
      walk(child, newBold, newItalic, newUnderline, newStrike, newColor, newFontSize);
    }
  }

  for (const child of el.childNodes) {
    walk(child, false, false, false, false, null, defaultFontSize);
  }

  return segs;
}

/**
 * Read text-align from a DOM element's inline style.
 */
function getAlign(el) {
  const style = el.style?.cssText || el.getAttribute?.("style") || "";
  const m = style.match(/text-align\s*:\s*(left|right|center|justify)/i);
  return m ? m[1] : null;
}

/**
 * Convert an HTML string (from RichTextEditor) to an NdaDocBlock[] array.
 * Must be called in a browser context (uses DOM APIs).
 */
export function htmlToNdaDoc(html) {
  if (!html?.trim()) return [];

  const div = document.createElement("div");
  div.innerHTML = html;

  const blocks = [];

  // inheritedFontSize: font-size (px) propagated from an ancestor inline wrapper.
  // 12 matches the editor's CSS default so unformatted text round-trips at the same size.
  function processNode(node, inheritedFontSize = 12) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.replace(/\u200B/g, "").replace(/\u00A0/g, " ").trim();
      if (text) {
        blocks.push({ type: "paragraph", align: null, segments: [{ text }] });
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();

    if (tag === "p") {
      const segs = extractSegments(node, inheritedFontSize);
      // Always push paragraph blocks, including empty ones (blank lines the user added).
      blocks.push({
        type: "paragraph",
        align: getAlign(node) || null,
        segments: segs,
      });
    } else if (tag === "h1" || tag === "h2" || tag === "h3") {
      // No default — the PDF renderer supplies the correct heading pt size.
      const segs = extractSegments(node, null);
      if (segs.length > 0) {
        blocks.push({
          type: "heading",
          level: parseInt(tag[1]),
          align: getAlign(node) || "left",
          segments: segs,
        });
      }
    } else if (tag === "ul") {
      // Use direct children only — querySelectorAll("li") would also pick up nested list items.
      const items = [...node.children]
        .filter((c) => c.tagName.toLowerCase() === "li")
        .map((li) => extractSegments(li, inheritedFontSize))
        .filter((s) => s.length > 0);
      if (items.length > 0) {
        blocks.push({ type: "bullet_list", items });
      }
    } else if (tag === "ol") {
      const items = [...node.children]
        .filter((c) => c.tagName.toLowerCase() === "li")
        .map((li) => extractSegments(li, inheritedFontSize))
        .filter((s) => s.length > 0);
      if (items.length > 0) {
        blocks.push({ type: "ordered_list", items });
      }
    } else if (tag === "br") {
      // ignore top-level <br>
    } else if (
      tag === "span" || tag === "font" || tag === "a" ||
      tag === "b" || tag === "strong" || tag === "i" || tag === "em" ||
      tag === "u" || tag === "s" || tag === "strike" || tag === "sub" || tag === "sup"
    ) {
      // Check whether this inline element is (incorrectly) wrapping block-level children.
      // This happens when the font-size handler wraps all paragraphs in a single <span>.
      const hasBlockChildren = [...node.childNodes].some(
        (c) =>
          c.nodeType === Node.ELEMENT_NODE &&
          ["p", "h1", "h2", "h3", "ul", "ol"].includes(c.tagName.toLowerCase())
      );

      if (hasBlockChildren) {
        // Propagate this element's font-size down, then recurse into each child block.
        const sizeM = (node.style?.cssText || "").match(/font-size\s*:\s*([\d.]+)px/i);
        const childFontSize = sizeM ? Math.round(parseFloat(sizeM[1])) : inheritedFontSize;
        for (const child of node.childNodes) {
          processNode(child, childFontSize);
        }
      } else {
        // Inline element at block level (e.g. <span style="font-size:72px"> with no <p> wrapper).
        // Wrap in a temporary <p> so extractSegments can walk styles correctly.
        const wrapper = document.createElement("p");
        wrapper.appendChild(node.cloneNode(true));
        const segs = extractSegments(wrapper, inheritedFontSize);
        if (segs.length > 0) {
          blocks.push({ type: "paragraph", align: null, segments: segs });
        }
      }
    } else {
      // Container elements (div, section, blockquote) — recurse into children
      for (const child of node.childNodes) {
        processNode(child, inheritedFontSize);
      }
    }
  }

  for (const child of div.childNodes) {
    processNode(child, 12);
  }

  return blocks;
}

// ── JSON → HTML

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Wrap a text string with inline HTML tags based on a segment's formatting.
 */
function segsToHtml(segments) {
  return segments
    .map((seg) => {
      let html = escapeHtml(seg.text);
      if (seg.fontSize) html = `<span style="font-size:${seg.fontSize}px">${html}</span>`;
      if (seg.color) html = `<font color="${seg.color}">${html}</font>`;
      if (seg.underline) html = `<u>${html}</u>`;
      if (seg.strike) html = `<s>${html}</s>`;
      if (seg.italic) html = `<em>${html}</em>`;
      if (seg.bold) html = `<strong>${html}</strong>`;
      return html;
    })
    .join("");
}

/**
 * Convert an NdaDocBlock[] array back to an HTML string for the RichTextEditor.
 */
export function ndaDocToHtml(blocks) {
  if (!blocks?.length) return "";

  return blocks
    .map((block) => {
      if (block.type === "paragraph") {
        const alignStyle =
          block.align && block.align !== "left"
            ? ` style="text-align:${block.align}"`
            : "";
        const content = segsToHtml(block.segments);
        return `<p${alignStyle}>${content || "<br>"}</p>`;
      }
      if (block.type === "heading") {
        const alignStyle =
          block.align && block.align !== "left"
            ? ` style="text-align:${block.align}"`
            : "";
        return `<h${block.level}${alignStyle}>${segsToHtml(block.segments)}</h${block.level}>`;
      }
      if (block.type === "bullet_list") {
        const items = block.items
          .map((segs) => `<li>${segsToHtml(segs)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      if (block.type === "ordered_list") {
        const items = block.items
          .map((segs) => `<li>${segsToHtml(segs)}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }
      return "";
    })
    .join("");
}
