/**
 * Flatten a fragment of Markdown and/or inline HTML into a single line of
 * readable prose, suitable for a feed card description.
 */
export function toPlainText(input, { maxLength = 300 } = {}) {
  if (!input) return '';

  let text = String(input);

  // Turn block boundaries into spaces before dropping tags, so words in
  // adjacent list items and paragraphs do not get glued together.
  text = text.replace(/<\s*(br|\/p|\/li|\/ul|\/ol|\/div|\/h[1-6])\s*\/?\s*>/gi, ' ');
  text = text.replace(/<[^>]*>/g, '');

  // Markdown links and images: keep the label, drop the target.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Emphasis, inline code and heading markers.
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/(^|\s)[*_]([^*_]+)[*_]/g, '$1$2');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/^#{1,6}\s*/gm, '');

  text = decodeEntities(text);
  text = text.replace(/\s+/g, ' ').trim();

  return truncate(text, maxLength);
}

/** Truncate on a word boundary and mark the cut with an ellipsis. */
export function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;

  const clipped = text.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  const base = lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped;

  return `${base.replace(/[\s.,;:]+$/, '')}…`;
}

export function decodeEntities(text) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘',
    rdquo: '”', ldquo: '“'
  };

  return String(text)
    .replace(/&#(\d+);/g, (_, code) => safeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => safeCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(named, key) ? named[key] : match;
    });
}

function safeCodePoint(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** Normalized form used to compare titles across runs. */
export function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'"“”‘’()]/g, '')
    .trim();
}
