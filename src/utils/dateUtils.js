/**
 * Formats a date string to a human-readable format (DD/MM/YYYY).
 * @param {string} dateString - The date string to format.
 * @returns {string} - Formatted date string in en-GB locale.
 */
export const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

/**
 * Formats a date with time in en-GB locale, including hour and minute.
 * @param {string} dateString - The date string to format.
 * @returns {string} - Formatted date and time string.
 */
export const formatDateTimeWithLocale = (dateString, opts = {}) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
    ...opts,
  });
};

/**
 * Determines the event status (Expired, Current, Upcoming) based on the event date range.
 * @param {string|Date} startDate - The start date of the event.
 * @param {string|Date} endDate - The end date of the event.
 * @returns {string} - Status of the event.
 */
export const getEventStatus = (startDate, endDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (today < start) return "Upcoming";
  if (today > end) return "Expired";
  return "Current";
};

/**
 * Formats a date string to a human-readable format with a short month name (en-GB).
 * @param {string} dateString - The date string to format.
 * @returns {string} - Formatted date string with short month.
 */
export const formatDateWithShortMonth = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

/**
 * Internal helper to create a Date object in a specific timezone.
 */
const createDateInTimezone = (dateString, timeString, timezone) => {
  const dateOnly = new Date(dateString).toISOString().split("T")[0];
  const [hours, minutes] = timeString.split(":");

  const dateTimeStr = `${dateOnly}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  let testDate = new Date(dateTimeStr);
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    const parts = formatter.formatToParts(testDate);
    const formattedHour = parts.find(p => p.type === "hour").value;
    const formattedMinute = parts.find(p => p.type === "minute").value;

    const hourDiff = parseInt(hours, 10) - parseInt(formattedHour, 10);
    const minuteDiff = parseInt(minutes, 10) - parseInt(formattedMinute, 10);

    if (hourDiff === 0 && minuteDiff === 0) {
      break;
    }

    testDate = new Date(testDate.getTime() + (hourDiff * 60 + minuteDiff) * 60 * 1000);
    iterations++;
  }

  return testDate;
};

/**
 * Formats time in en-GB locale. 
 */
export const formatTime = (input, eventTimezone = null, dateString = null) => {
  if (!input) return "";

  let date;
  if (input instanceof Date) {
    date = new Date(input);
  } else if (typeof input === "string" && (input.includes("T") || input.includes("Z"))) {
    // It's an ISO string (e.g. 2026-03-30T20:30:00Z)
    date = new Date(input);
  } else if (typeof input === "string" && input.includes(":")) {
    // It's a raw time string (e.g. 20:30)
    const [hours, minutes] = input.split(":");
    date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  } else if (typeof input === "number") {
    date = new Date(input);
  } else {
    return "";
  }

  if (isNaN(date.getTime())) return "";

  if (eventTimezone && dateString) {
    const isRawTimeString = typeof input === "string" && input.includes(":") && !input.includes("T");
    const eventDate = createDateInTimezone(dateString, isRawTimeString ? input : getLocalTime(input), eventTimezone);
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: userTimezone,
    }).format(eventDate);
  }

  return date.toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * Combines date and time display using en-GB locale.
 */
export const formatDateWithTime = (dateString, timeString, eventTimezone = null) => {
  if (!timeString) {
    return formatDateWithShortMonth(dateString);
  }

  if (eventTimezone) {
    const eventDate = createDateInTimezone(dateString, timeString, eventTimezone);
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const timeFormatted = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: userTimezone,
    }).format(eventDate);

    const dateFormattedLocal = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: userTimezone,
    }).format(eventDate);

    return `${dateFormattedLocal} ${timeFormatted}`;
  }

  const dateFormatted = formatDateWithShortMonth(dateString);
  const timeFormatted = formatTime(timeString);
  return `${dateFormatted} ${timeFormatted}`;
};

/**
 * Extracts the local date in YYYY-MM-DD format from an ISO string.
 * Used for form field values.
 */
export const getLocalDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Extracts the local time in HH:mm format from an ISO string.
 * Used for form field values.
 */
export const getLocalTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

export const convertTimeToLocal = (timeString, dateString, eventTimezone) => {
  if (!timeString || !eventTimezone) return timeString;
  const eventDate = createDateInTimezone(dateString, timeString, eventTimezone);
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: userTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(eventDate);
  const hour = parts.find(p => p.type === "hour").value.padStart(2, "0");
  const minute = parts.find(p => p.type === "minute").value.padStart(2, "0");
  return `${hour}:${minute}`;
};

export const convertTimeFromLocal = (timeString, dateString, eventTimezone) => {
  if (!timeString || !eventTimezone) return timeString;
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (userTimezone === eventTimezone) return timeString;

  const [hours, minutes] = timeString.split(":");
  const dateOnly = new Date(dateString).toISOString().split("T")[0];
  const dateTimeStr = `${dateOnly}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;
  const localDate = new Date(dateTimeStr);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: eventTimezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  let testDate = localDate;
  let iterations = 0;
  const maxIterations = 10;
  while (iterations < maxIterations) {
    const parts = formatter.formatToParts(testDate);
    const formattedHour = parts.find(p => p.type === "hour").value;
    const formattedMinute = parts.find(p => p.type === "minute").value;
    const hourDiff = parseInt(hours, 10) - parseInt(formattedHour, 10);
    const minuteDiff = parseInt(minutes, 10) - parseInt(formattedMinute, 10);
    if (hourDiff === 0 && minuteDiff === 0) break;
    testDate = new Date(testDate.getTime() + (hourDiff * 60 + minuteDiff) * 60 * 1000);
    iterations++;
  }

  const resultFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: eventTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const resultParts = resultFormatter.formatToParts(testDate);
  const resultHour = resultParts.find(p => p.type === "hour").value.padStart(2, "0");
  const resultMinute = resultParts.find(p => p.type === "minute").value.padStart(2, "0");
  return `${resultHour}:${resultMinute}`;
};

/**
 * Internal logic for 12/24h conversion used by CMS time pickers.
 */
export const parse24To12 = (time24) => {
  if (!time24) return { hour12: 12, minute: "00", ampm: "AM" };
  const [h24, m] = time24.split(":");
  let hour = parseInt(h24, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return { hour12: hour, minute: m || "00", ampm };
};

export const convert12To24 = (hour12, minute, ampm) => {
  let hour = parseInt(hour12, 10);
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};