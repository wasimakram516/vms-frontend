export default function slugify(text) {
    return text
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")                   // Normalize accented characters
      .replace(/[\u0300-\u036f]/g, "")    // Remove accents
      .replace(/[^a-z0-9 -]/g, "")        // Remove invalid chars
      .replace(/\s+/g, "-")               // Collapse whitespace and replace by -
      .replace(/-+/g, "-")                // Collapse dashes
      .replace(/^-+|-+$/g, "");           // Trim dashes from start/end
  }
  