import { useEffect, useState } from 'react';

/**
 * Delays a changing value so network-backed filters do not request on every keypress.
 *
 * @template T
 * @param {T} value Value to debounce.
 * @param {number} delayMs Delay in milliseconds.
 * @returns {T} Debounced value.
 */
export default function useDebouncedValue(value, delayMs = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}
