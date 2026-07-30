import axios from 'axios';

const USER_AGENT = 'Mozilla/5.0 (compatible; AnalyticsVendorTracker/2.0; +https://github.com/NHinternesch/analytics-vendor-updates-tracker)';

/**
 * Fetch a URL as text, retrying transient failures with a short backoff.
 * Throws on a non-2xx response so a broken source surfaces as an error
 * rather than as an empty result.
 */
export async function fetchText(url, { timeout = 20000, retries = 2 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await delay(1000 * attempt);
    }

    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout,
        responseType: 'text',
        transformResponse: [(body) => body],
        validateStatus: () => true
      });

      if (response.status >= 200 && response.status < 300) {
        return String(response.data);
      }

      lastError = new Error(`HTTP ${response.status} from ${url}`);

      // Client errors (bad path, gone) will not fix themselves on retry.
      if (response.status >= 400 && response.status < 500) break;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
