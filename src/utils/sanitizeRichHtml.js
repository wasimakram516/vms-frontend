import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "sub",
  "sup",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "span",
  "a",
];

const STYLE_VALIDATORS = {
  color: (value) => /^(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\))$/i.test(value),
  "font-size": (value) => {
    const match = value.match(/^(\d{1,3}(?:\.\d+)?)px$/i);
    if (!match) return false;
    const size = Number(match[1]);
    return size >= 8 && size <= 100;
  },
  "font-weight": (value) => /^(normal|bold|[1-9]00)$/i.test(value),
  "font-style": (value) => /^(normal|italic)$/i.test(value),
  "text-decoration": (value) =>
    /^(none|underline|line-through)(\s+(underline|line-through))?$/i.test(
      value,
    ),
  "text-align": (value) => /^(left|right|center|justify)$/i.test(value),
};

/** Keep only the small set of formatting declarations supported by the editor. */
const sanitizeStyle = (element) => {
  const safeDeclarations = [];
  for (const property of Array.from(element.style)) {
    const value = element.style.getPropertyValue(property).trim();
    const validator = STYLE_VALIDATORS[property];
    if (validator?.(value)) safeDeclarations.push(`${property}:${value}`);
  }

  if (safeDeclarations.length > 0) {
    element.setAttribute("style", safeDeclarations.join(";"));
  } else {
    element.removeAttribute("style");
  }
};

/** Allow only HTTPS and mail links and protect links opening a new tab. */
const sanitizeLink = (element) => {
  const href = element.getAttribute("href");
  if (href && !/^(https:\/\/|mailto:)/i.test(href)) {
    element.removeAttribute("href");
  }
  const target = element.getAttribute("target");
  if (target && !["_blank", "_self"].includes(target)) {
    element.removeAttribute("target");
  }
  if (target === "_blank") {
    element.setAttribute("rel", "noopener noreferrer");
  } else {
    element.removeAttribute("rel");
  }
};

/** Sanitize intentional rich HTML using the product's strict formatting allowlist. */
export const sanitizeRichHtml = (html) => {
  if (typeof html !== "string" || !html.trim()) return "";

  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "target", "rel", "style"],
    FORBID_TAGS: [
      "script",
      "style",
      "svg",
      "math",
      "img",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "video",
      "audio",
      "source",
    ],
  });

  const template = document.createElement("template");
  template.innerHTML = sanitized;
  template.content.querySelectorAll("[style]").forEach(sanitizeStyle);
  template.content.querySelectorAll("a").forEach(sanitizeLink);
  return template.innerHTML;
};
