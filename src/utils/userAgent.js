/** Extract the first matching product name and version from a user-agent string. */
function matchProduct(userAgent, patterns) {
  for (const [name, pattern] of patterns) {
    const match = userAgent.match(pattern);
    if (match) return `${name} ${match[1]}`;
  }
  return "Unknown";
}

/** Convert a raw user-agent string into concise audit-friendly labels. */
export function parseUserAgent(userAgent) {
  if (!userAgent) {
    return {
      browser: "Unknown",
      operatingSystem: "Unknown",
      device: "Unknown",
    };
  }

  const browser = matchProduct(userAgent, [
    ["Microsoft Edge", /Edg\/([\d.]+)/i],
    ["Opera", /(?:OPR|Opera)\/([\d.]+)/i],
    ["Firefox", /Firefox\/([\d.]+)/i],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/i],
    ["Safari", /Version\/([\d.]+).*Safari/i],
  ]);

  let operatingSystem = "Unknown";
  if (/Windows NT 10\.0/i.test(userAgent)) operatingSystem = "Windows 10 or 11";
  else if (/Windows NT 6\.3/i.test(userAgent)) operatingSystem = "Windows 8.1";
  else if (/Windows NT 6\.1/i.test(userAgent)) operatingSystem = "Windows 7";
  else if (/Android\s([\d.]+)/i.test(userAgent)) {
    operatingSystem = `Android ${userAgent.match(/Android\s([\d.]+)/i)?.[1]}`;
  } else if (/(?:iPhone|iPad).*OS\s([\d_]+)/i.test(userAgent)) {
    operatingSystem = `iOS ${userAgent
      .match(/(?:iPhone|iPad).*OS\s([\d_]+)/i)?.[1]
      .replaceAll("_", ".")}`;
  } else if (/Mac OS X\s([\d_]+)/i.test(userAgent)) {
    operatingSystem = `macOS ${userAgent
      .match(/Mac OS X\s([\d_]+)/i)?.[1]
      .replaceAll("_", ".")}`;
  } else if (/Linux/i.test(userAgent)) operatingSystem = "Linux";

  const device = /iPad|Tablet/i.test(userAgent)
    ? "Tablet"
    : /Mobile|Android|iPhone|iPod/i.test(userAgent)
      ? "Mobile"
      : "Desktop";

  return { browser, operatingSystem, device };
}
