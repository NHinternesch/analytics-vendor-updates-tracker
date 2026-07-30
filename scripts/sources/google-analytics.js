import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.js';
import { parseDate, isFuture } from '../lib/dates.js';
import { toPlainText } from '../lib/text.js';

const PAGE_URL = 'https://support.google.com/analytics/answer/9164320';

/**
 * Google publishes no feed for the GA4 release notes, so this one still reads
 * the support page. The page groups releases under a dated `h2` that carries
 * an id (e.g. `id="07282026"`), which gives us a deep link per release date;
 * each feature below it is an `h3` followed by prose.
 */
export default {
  id: 'google-analytics',
  name: 'Google Analytics',
  homepage: `${PAGE_URL}?hl=en`,

  minExpected: 5,

  async fetchUpdates() {
    const html = await fetchText(`${PAGE_URL}?hl=en`);
    const $ = cheerio.load(html);

    const items = [];

    $('h2').each((_, heading) => {
      const $heading = $(heading);
      const date = parseDate($heading.text());
      if (!date || isFuture(date)) return;

      // Anchor ids let each entry link to its own section of the page.
      const anchor = $heading.attr('id');
      const url = anchor ? `${PAGE_URL}#${anchor}` : PAGE_URL;

      // Walk forward until the next dated section starts.
      for (let node = $heading.next(); node.length && !node.is('h2'); node = node.next()) {
        if (!node.is('h3')) continue;

        const title = toPlainText(node.text(), { maxLength: 150 });
        if (!title || title.length < 4 || parseDate(title)) continue;

        const description = collectDescription($, node);
        if (!description || description.length < 20) continue;

        items.push({ title, description, date, url });
      }
    });

    return items;
  }
};

/** Gather the prose between an `h3` feature heading and whatever follows it. */
function collectDescription($, $featureHeading) {
  const parts = [];

  for (let node = $featureHeading.next(); node.length; node = node.next()) {
    if (node.is('h2, h3')) break;
    if (node.is('p, ul, ol')) {
      const text = toPlainText(node.text(), { maxLength: 400 });
      if (text) parts.push(text);
    }
    if (parts.length >= 2) break;
  }

  return toPlainText(parts.join(' '));
}
