/**
 * Formats a date string to a human-readable format.
 * @param {string} dateString - The date string to format.
 * @returns {string} - Formatted date string.
 */
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

/**
 * Formats a date with time in a locale-aware way, including hour and minute.
 * @param {string} dateString - The date string to format.
 * @param {string} locale - The locale to use. Defaults to "en-GB".
 * @returns {string} - Formatted date and time string.
 */
export const formatDateTimeWithLocale = (dateString, locale = "en-GB") => {
  const date = new Date(dateString);

  const formatted = date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return formatted;
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
 * Formats a date string to a human-readable format with a short month name.
 * @param {string} dateString - The date string to format.
 * @returns {string} - Formatted date string with short month.
 */
export const formatDateWithShortMonth = (dateString, locale = "en-GB") => {
  const date = new Date(dateString);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

  return formatted;
};

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

export const formatTime = (timeString, locale = "en-GB", eventTimezone = null, dateString = null) => {
  if (!timeString) return "";

  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const minute = parseInt(minutes, 10);

  if (eventTimezone && dateString) {
    const eventDate = createDateInTimezone(dateString, timeString, eventTimezone);
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const formatted = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: userTimezone,
    }).format(eventDate);

    return formatted;
  }

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  const formatted = date.toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).toUpperCase();

  return formatted;
};

/**
 * Parses a 24-hour time string (HH:mm) into 12-hour components.
 * @param {string} time24 "HH:mm"
 * @returns {{ hour12: number, minute: string, ampm: string }}
 */
export const parse24To12 = (time24) => {
  if (!time24) return { hour12: 12, minute: "00", ampm: "AM" };
  const [h24, min] = time24.split(":").map(Number);
  const ampm = h24 >= 12 ? "PM" : "AM";
  const hour12 = h24 % 12 || 12;
  return { hour12, minute: String(min || 0).padStart(2, "0"), ampm };
};

/**
 * Converts 12-hour components back to a 24-hour time string (HH:mm).
 * @param {number|string} hr 1-12
 * @param {number|string} min 0-59
 * @param {string} ampm "AM"|"PM"
 * @returns {string} "HH:mm"
 */
export const convert12To24 = (hr, min, ampm) => {
  let h24 = parseInt(hr, 10);
  const m = String(min).padStart(2, "0");
  
  if (ampm === "PM" && h24 < 12) h24 += 12;
  if (ampm === "AM" && h24 === 12) h24 = 0;
  
  return `${String(h24).padStart(2, "0")}:${m}`;
};

export const formatDateWithTime = (dateString, timeString, locale = "en-GB", eventTimezone = null) => {
  if (!timeString) {
    return formatDateWithShortMonth(dateString, locale);
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

  const dateFormatted = formatDateWithShortMonth(dateString, locale);
  const timeFormatted = formatTime(timeString, locale);
  return `${dateFormatted} ${timeFormatted}`;
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

  if (userTimezone === eventTimezone) {
    return timeString;
  }

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

    if (hourDiff === 0 && minuteDiff === 0) {
      break;
    }

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