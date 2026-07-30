import { writeFileSync, readFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sources } from './sources/index.js';
import { normalizeTitle } from './lib/text.js';
import { delay } from './lib/http.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../data/updates.json');
const HEALTH_FILE = join(__dirname, '../data/health.json');

const MAX_UPDATES_PER_VENDOR = 100;
const DELAY_BETWEEN_SOURCES = 1500;

async function main() {
  const data = loadData();
  const before = fingerprint(data);
  const health = [];

  for (const [index, source] of sources.entries()) {
    if (index > 0) await delay(DELAY_BETWEEN_SOURCES);

    console.log(`\n→ ${source.name}`);

    let fetched;
    try {
      fetched = await source.fetchUpdates();
    } catch (error) {
      console.error(`  ✗ fetch failed: ${error.message}`);
      health.push({
        id: source.id,
        name: source.name,
        ok: false,
        found: 0,
        minExpected: source.minExpected,
        error: error.message
      });
      continue;
    }

    const vendor = vendorFor(data, source);
    const { added, updated, dropped } = merge(vendor, fetched, source.dedupeBy);

    const ok = fetched.length >= source.minExpected;
    console.log(
      `  ${ok ? '✓' : '✗'} ${fetched.length} found (min ${source.minExpected})` +
      ` · ${added} new · ${updated} refreshed` +
      // Only worth reporting when new items actually pushed old ones out. A feed
      // that simply reaches further back than we retain would otherwise print
      // the same overflow every single day and bury the real signal.
      (dropped && added ? ` · ${dropped} aged out past the ${MAX_UPDATES_PER_VENDOR}-item cap` : '')
    );

    health.push({
      id: source.id,
      name: source.name,
      ok,
      found: fetched.length,
      minExpected: source.minExpected,
      error: ok ? null : `Returned ${fetched.length} items, expected at least ${source.minExpected}`
    });
  }

  // Only touch the data file when the content actually changed. Previously the
  // timestamp was rewritten unconditionally, which produced a commit every day
  // regardless of whether any vendor had shipped anything.
  const changed = fingerprint(data) !== before;

  if (changed) {
    data.lastUpdated = new Date().toISOString();
    writeFileSync(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`\nContent changed — wrote ${DATA_FILE}`);
  } else {
    console.log('\nNo content changes — data file left untouched');
  }

  writeFileSync(HEALTH_FILE, `${JSON.stringify({
    checkedAt: new Date().toISOString(),
    changed,
    sources: health
  }, null, 2)}\n`);

  reportSummary(health, changed);
}

/** Stable representation of the feed content, ignoring metadata timestamps. */
function fingerprint(data) {
  return JSON.stringify(data.competitors);
}

function loadData() {
  try {
    const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
    if (Array.isArray(parsed?.competitors)) return parsed;
    console.warn('Existing data file has no competitors array — starting fresh');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // Refuse to silently discard a file we simply failed to read.
      throw new Error(`Could not read ${DATA_FILE}: ${error.message}`);
    }
  }

  return { competitors: [], lastUpdated: new Date().toISOString() };
}

function vendorFor(data, source) {
  let vendor = data.competitors.find((candidate) => candidate.id === source.id);

  if (!vendor) {
    vendor = { id: source.id, name: source.name, updates: [] };
    data.competitors.push(vendor);
  }

  vendor.name = source.name;
  if (!Array.isArray(vendor.updates)) vendor.updates = [];

  return vendor;
}

/**
 * Merge freshly fetched items into a vendor's stored list.
 *
 * Counts are computed after the cap is applied, so a vendor whose feed reaches
 * further back than we retain does not report the same items as "new" forever.
 */
function merge(vendor, fetched, dedupeBy) {
  const key = (update) => identity(update, dedupeBy);

  const before = new Set(vendor.updates.map(key));
  const byKey = new Map(vendor.updates.map((update) => [key(update), update]));
  const byTitle = new Map(vendor.updates.map((update) => [normalizeTitle(update.title), update]));

  const changed = new Set();

  for (const item of fetched) {
    // The title-based fallback only exists to migrate entries stored before
    // deep links, which affects the shared-URL sources alone.
    const existing = byKey.get(key(item)) ||
      (dedupeBy === 'url' ? null : legacyMatch(byTitle, item));

    if (existing) {
      if (applyTo(existing, item)) changed.add(key(existing));
      byKey.set(key(existing), existing);
      continue;
    }

    const inserted = { ...item };
    vendor.updates.push(inserted);
    byKey.set(key(inserted), inserted);
    byTitle.set(normalizeTitle(inserted.title), inserted);
  }

  vendor.updates.sort(byDateDescending);

  const overflow = Math.max(0, vendor.updates.length - MAX_UPDATES_PER_VENDOR);
  if (overflow) vendor.updates.length = MAX_UPDATES_PER_VENDOR;

  const after = new Set(vendor.updates.map(key));

  return {
    added: [...after].filter((id) => !before.has(id)).length,
    updated: [...changed].filter((id) => after.has(id)).length,
    dropped: overflow
  };
}

/**
 * How an entry is recognized across runs.
 *
 * Amplitude's URLs are per-release permalinks, so the URL alone identifies an
 * entry — and must, because a stored title may differ slightly from the feed's.
 * Google and Adobe share one URL across many entries (a dated anchor, or the
 * release-notes page), so those need the title too. A repeated title such as
 * "Bug fixes" therefore still survives as its own entry.
 */
function identity(update, dedupeBy = 'url+title') {
  const url = update.url || '';

  return dedupeBy === 'url' ? url : `${url}::${normalizeTitle(update.title)}`;
}

/**
 * Adopt entries stored before per-item deep links existed. Those point at a
 * vendor's generic release-notes page; matching on title lets the entry be
 * upgraded in place instead of reappearing as a duplicate.
 */
function legacyMatch(byTitle, item) {
  const candidate = byTitle.get(normalizeTitle(item.title));
  if (!candidate) return null;

  const isLegacyUrl = !candidate.url?.includes('#') && candidate.url !== item.url;

  return isLegacyUrl ? candidate : null;
}

/** Copy improved values onto a stored entry. Returns true if anything moved. */
function applyTo(existing, item) {
  let dirty = false;

  for (const field of ['title', 'description', 'date', 'url']) {
    if (item[field] && item[field] !== existing[field]) {
      existing[field] = item[field];
      dirty = true;
    }
  }

  return dirty;
}

function byDateDescending(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return String(a.title).localeCompare(String(b.title));
}

function reportSummary(health, changed) {
  const failed = health.filter((entry) => !entry.ok);

  const lines = [
    '| Source | Found | Min | Status |',
    '| --- | --- | --- | --- |',
    ...health.map((entry) =>
      `| ${entry.name} | ${entry.found} | ${entry.minExpected} | ${entry.ok ? '✅ ok' : `❌ ${entry.error}`} |`
    ),
    '',
    changed ? 'Feed content changed.' : 'No feed content changes.'
  ];

  console.log(`\n${lines.join('\n')}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  }

  if (failed.length) {
    console.error(`\n${failed.length} of ${health.length} sources unhealthy: ${failed.map((f) => f.id).join(', ')}`);
  }
}

// A source failure must not stop the run: healthy vendors still merge, the
// site still deploys, and `check-health.js` fails the workflow afterwards so
// the breakage is visible instead of silent.
await main();
