import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEALTH_FILE = join(__dirname, '../data/health.json');

// Runs after the site has been built and deployed, so a single broken vendor
// turns the workflow red without blocking the updates that did work.
let report;
try {
  report = JSON.parse(readFileSync(HEALTH_FILE, 'utf-8'));
} catch (error) {
  console.error(`Could not read scrape health report: ${error.message}`);
  process.exit(1);
}

const failed = (report.sources || []).filter((source) => !source.ok);

for (const source of report.sources || []) {
  console.log(`${source.ok ? '✓' : '✗'} ${source.name}: ${source.found} items` +
    (source.ok ? '' : ` — ${source.error}`));
}

if (failed.length) {
  console.error(`\n${failed.length} source(s) failed. A scraper is probably out of date.`);
  process.exit(1);
}

console.log('\nAll sources healthy.');
