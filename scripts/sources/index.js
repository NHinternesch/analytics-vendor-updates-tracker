import amplitude from './amplitude.js';
import adobeCja from './adobe-cja.js';
import googleAnalytics from './google-analytics.js';

/**
 * Every tracked vendor implements the same shape:
 *
 *   id           stable slug, also the filter key in the UI
 *   name         display name
 *   homepage     where a human goes to read the source
 *   minExpected  fewest items a healthy run should return
 *   fetchUpdates async () => Array<{ title, description, date, url }>
 *
 * To track another vendor, add a module here that exports that shape. The
 * scraper picks it up with no further wiring.
 */
export const sources = [googleAnalytics, adobeCja, amplitude];
