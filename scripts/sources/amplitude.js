import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.js';
import { parseDate } from '../lib/dates.js';
import { toPlainText } from '../lib/text.js';

const FEED_URL = 'https://amplitude.com/releases/feed.xml';

/**
 * Amplitude publishes a full RSS feed of its release notes. It carries a
 * title, a per-release permalink, a description and a real pubDate, which
 * makes scraping the (frequently redesigned) HTML listing unnecessary.
 */
export default {
  id: 'amplitude',
  name: 'Amplitude',
  homepage: 'https://amplitude.com/releases',

  // The feed carries ~200 entries; anything near zero means it moved or broke.
  minExpected: 25,

  // Each release has its own permalink, so the URL identifies an entry on its
  // own — and must, since titles stored by the old scraper differ slightly.
  dedupeBy: 'url',

  async fetchUpdates() {
    const xml = await fetchText(FEED_URL);
    const $ = cheerio.load(xml, { xmlMode: true });

    const items = [];

    $('item').each((_, element) => {
      const $item = $(element);

      const title = toPlainText($item.find('title').first().text(), { maxLength: 150 });
      const url = $item.find('link').first().text().trim() ||
        $item.find('guid').first().text().trim();
      const date = parseDate($item.find('pubDate').first().text());

      if (!title || !url || !date) return;

      const category = $item.find('category').first().text().trim();
      const body = $item.find('description').first().text() ||
        $item.find('content\\:encoded').first().text();

      let description = toPlainText(body);
      if (!description) {
        description = category
          ? `Amplitude release in ${category}.`
          : 'Amplitude product release.';
      }

      items.push({ title, description, date, url });
    });

    return items;
  }
};
