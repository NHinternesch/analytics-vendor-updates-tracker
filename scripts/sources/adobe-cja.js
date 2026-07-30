import { fetchText } from '../lib/http.js';
import { parseDate, isFuture } from '../lib/dates.js';
import { toPlainText, truncate } from '../lib/text.js';

// Adobe authors the Experience League docs in the open, so we read the
// Markdown source rather than the rendered page. It is stable, versioned and
// immune to the front-end redesigns that repeatedly broke the HTML scraper.
const SOURCE_URL = 'https://raw.githubusercontent.com/AdobeDocs/analytics-platform.en/main/help/release-notes/latest.md';
const PAGE_URL = 'https://experienceleague.adobe.com/en/docs/analytics-platform/using/releases/latest';

// Features listed under this heading are announced but not shipped.
const POSTPONED_HEADING = /^##\s+Postponed features/im;

export default {
  id: 'adobe-cja',
  name: 'Adobe CJA',
  homepage: PAGE_URL,

  // The page covers one release cycle, so the row count legitimately varies.
  // Structural breakage is caught by the explicit throw below instead.
  minExpected: 1,

  async fetchUpdates() {
    const markdown = await fetchText(SOURCE_URL);

    const body = stripFrontmatter(markdown).split(POSTPONED_HEADING)[0];
    const rows = body.split('\n').filter((line) => line.trim().startsWith('|'));

    const items = [];
    let parsedRows = 0;

    for (const row of rows) {
      const cells = splitRow(row);
      if (cells.length < 2) continue;

      const [featureCell, rolloutCell = '', availabilityCell = ''] = cells;

      // Skip the header and the `|---|---|` separator.
      if (/^-{2,}$/.test(featureCell.replace(/[\s|]/g, ''))) continue;
      if (/^feature and description$/i.test(featureCell.trim())) continue;

      const titleMatch = featureCell.match(/\*\*(.+?)\*\*/s);
      if (!titleMatch) continue;

      const title = truncate(toPlainText(titleMatch[1]), 150);
      if (!title) continue;

      parsedRows++;

      // Prefer the rollout date: it is when customers actually start seeing
      // the feature, and it is the earlier of the two.
      const date = firstReleasedDate([rolloutCell, availabilityCell]);
      if (!date) continue;

      const description = toPlainText(featureCell.replace(titleMatch[0], ''));
      if (!description || description.length < 20) continue;

      items.push({
        title,
        description,
        date,
        url: documentationLink(featureCell) || PAGE_URL
      });
    }

    if (parsedRows === 0) {
      throw new Error(`No feature rows found in ${SOURCE_URL} — the release notes format has likely changed`);
    }

    return items;
  }
};

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

/** Split a Markdown table row into cells, honouring escaped pipes. */
function splitRow(row) {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, '|').trim());
}

/** First date among the cells that is parseable and not in the future. */
function firstReleasedDate(cells) {
  for (const cell of cells) {
    // Drop parentheticals like "TBD<p>(Originally planned for October 29, 2025)</p>"
    // so a superseded date is never mistaken for the real one.
    const cleaned = cell.replace(/<p>[\s\S]*?<\/p>/gi, ' ').trim();
    if (!cleaned || /TBD/i.test(cleaned)) continue;

    const date = parseDate(cleaned);
    if (date && !isFuture(date)) return date;
  }

  return null;
}

/**
 * Adobe's rows often reference the feature's documentation. Only absolute
 * links are usable — the repo-relative `/help/....md` paths do not map onto
 * public Experience League URLs.
 */
function documentationLink(cell) {
  const links = [...cell.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map((match) => match[1]);

  return links.find((link) => link.includes('experienceleague.adobe.com')) || links[0] || null;
}
