const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
};

const LONG_DATE = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/i;

/**
 * Parse a date into a `YYYY-MM-DD` string, or return null if it cannot be
 * parsed confidently.
 *
 * Returning null is deliberate: an earlier version fell back to "today" for
 * anything it could not read, which turned every parse failure into a
 * fake brand-new release.
 */
export function parseDate(input) {
  if (!input) return null;

  const text = String(input).trim();
  if (!text) return null;

  // "July 21, 2026" — build in UTC so a local timezone offset cannot shift
  // the calendar day backwards when serializing.
  const longMatch = text.match(LONG_DATE);
  if (longMatch) {
    const month = MONTHS[longMatch[1].toLowerCase()];
    const day = Number(longMatch[2]);
    const year = Number(longMatch[3]);

    if (day >= 1 && day <= 31) {
      return toIsoDay(Date.UTC(year, month, day));
    }
  }

  // RFC 822 (RSS pubDate) and ISO 8601 both carry an explicit offset, so the
  // instant is unambiguous and Date can be trusted here.
  if (/\d{4}/.test(text)) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
}

/** True when an ISO day string is later than today (UTC). */
export function isFuture(isoDay) {
  return isoDay > todayIso();
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDay(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}
