import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataFile = join(__dirname, '../data/updates.json');

// Competitor data sources and scraping logic
const competitors = [
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    urls: [
      'https://support.google.com/analytics/answer/9164320?hl=en'
    ]
  },
  {
    id: 'adobe-cja',
    name: 'Adobe CJA',
    urls: [
      'https://experienceleague.adobe.com/en/docs/analytics-platform/using/releases/latest'
    ]
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    urls: [
      'https://amplitude.com/releases'
    ]
  }
];

// Load existing data
function loadExistingData() {
  try {
    const data = readFileSync(dataFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {
      competitors: competitors.map(c => ({
        id: c.id,
        name: c.name,
        updates: []
      })),
      lastUpdated: new Date().toISOString()
    };
  }
}

// Save data
function saveData(data) {
  data.lastUpdated = new Date().toISOString();
  writeFileSync(dataFile, JSON.stringify(data, null, 2));
  console.log(`Data saved at ${data.lastUpdated}`);
}

// Helper to format dates
function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

// Helper to parse date strings like "Nov 25", "Nov25", or "November 25, 2025"
function parseRelativeDate(dateStr) {
  const months = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5,
    jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
    oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
  };

  // Try to parse "Nov 25", "Nov25" (with or without space)
  const shortMatch = dateStr.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(\d{1,2})/i);
  if (shortMatch) {
    const month = months[shortMatch[1].toLowerCase()];
    const day = parseInt(shortMatch[2]);
    const now = new Date();
    let year = now.getFullYear();

    // Create date with current year
    const testDate = new Date(year, month, day);

    // If the date is more than 30 days in the future, it's likely from last year
    if (testDate > now && (testDate - now) > (30 * 24 * 60 * 60 * 1000)) {
      year--;
    }

    return formatDate(new Date(year, month, day));
  }

  // Try full date
  return formatDate(dateStr);
}

// Helper to check if update exists (checking title only to avoid date variation duplicates)
function updateExists(updates, newUpdate) {
  return updates.some(u =>
    u.title.toLowerCase().trim() === newUpdate.title.toLowerCase().trim()
  );
}

// Scraper for Amplitude
async function scrapeAmplitudeUpdates() {
  try {
    console.log('Scraping Amplitude releases...');
    const response = await axios.get('https://amplitude.com/releases', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AnalyticsTracker/1.0)'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const releaseLinks = [];

    // Collect release links from the listing page
    // Structure: <a class="block mb-1 group" href="/releases/...">
    //   <div> (flex container)
    //     <div> emoji </div>
    //     <div> (content)
    //       <div class="text-sm font-medium ..."> title </div>
    //       <div class="text-xs text-gray-60 ..."> date </div>
    //       <div> <span> category </span> </div>
    //     </div>
    //   </div>
    // </a>
    $('a[href^="/releases/"]').each((i, elem) => {
      if (releaseLinks.length >= 35) return false;

      const href = $(elem).attr('href');
      if (!href || href === '/releases') return;

      const titleDiv = $(elem).find('.text-sm.font-medium').first();
      const dateDiv = $(elem).find('.text-xs.text-gray-60').first();
      const categorySpan = $(elem).find('span.inline-block').first();

      const title = titleDiv.text().trim();
      const dateText = dateDiv.text().trim();
      const category = categorySpan.text().trim();

      if (!title || title.length < 5 || !dateText) return;

      const date = parseRelativeDate(dateText);
      const url = `https://amplitude.com${href}`;

      releaseLinks.push({ title, date, category, url });
    });

    console.log(`  Found ${releaseLinks.length} Amplitude release links, fetching descriptions...`);

    // Fetch descriptions from individual release pages (meta description tag)
    const updates = [];
    for (const release of releaseLinks) {
      let description = release.category
        ? `Category: ${release.category}`
        : `Amplitude product update: ${release.title}`;

      try {
        const detailResp = await axios.get(release.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AnalyticsTracker/1.0)' },
          timeout: 10000
        });
        const detail$ = cheerio.load(detailResp.data);
        const metaDesc = detail$('meta[name="description"]').attr('content');
        if (metaDesc && metaDesc.length > 20) {
          description = metaDesc.substring(0, 300);
        }
        // Small delay between detail page requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch {
        // Fall back to category-based description
      }

      updates.push({
        title: release.title.substring(0, 150),
        description,
        date: release.date,
        url: release.url
      });
    }

    console.log(`✓ Found ${updates.length} Amplitude updates`);
    return updates;

  } catch (error) {
    console.error('✗ Error scraping Amplitude:', error.message);
    return [];
  }
}

// Scraper for Adobe CJA
async function scrapeAdobeCJAUpdates() {
  try {
    console.log('Scraping Adobe CJA releases...');
    const response = await axios.get('https://experienceleague.adobe.com/en/docs/analytics-platform/using/releases/latest', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AnalyticsTracker/1.0)'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const updates = [];

    // Adobe now uses a table structure with divs
    // Find the main features table (has class "table")
    const featureTable = $('div.table').first();

    if (featureTable.length) {
      // Get all rows - first row is header, skip it
      const rows = featureTable.children('div');

      rows.each((i, row) => {
        // Skip header row (first one) and limit to 20 features
        if (i === 0 || updates.length >= 20) return;

        const $row = $(row);
        const cells = $row.children('div');

        // Table has 3 columns: Feature+Description | Rollout starts | General Availability
        if (cells.length >= 3) {
          // Get feature name from first cell (contains <strong>)
          const firstCell = $(cells[0]);
          const titleElem = firstCell.find('strong');
          const title = titleElem.text().trim();

          // Skip if no title or too short
          if (!title || title.length < 10) return;

          // Get description from the same first cell (text after the <strong>/<br>)
          // Remove the title text to get only the description
          let description = firstCell.find('p').map((j, p) => $(p).text().trim()).get().join(' ');

          // If no paragraphs, get all text from the cell
          if (!description || description.length < 20) {
            description = firstCell.text().trim();
          }

          // Remove the title from the description if it starts with it
          if (description.startsWith(title)) {
            description = description.substring(title.length).trim();
          }

          description = description.replace(/\s+/g, ' ').substring(0, 300);

          // Skip if description is too short or empty
          if (!description || description.length < 30) {
            return;
          }

          // Get date from third cell (General Availability)
          let dateText = $(cells[2]).text().trim();

          // If GA is empty or TBD, try second cell (Rollout starts)
          if (!dateText || dateText === 'TBD' || dateText.length < 5) {
            dateText = $(cells[1]).text().trim();
          }

          // Skip if still no valid date
          if (!dateText || dateText === 'TBD' || dateText.length < 5) {
            return;
          }

          // Parse the date - look for "Month Day, Year" pattern
          const dateMatch = dateText.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i);

          // Only add if we have a valid date match and it's not in the future
          if (dateMatch) {
            const parsedDate = new Date(dateMatch[0]);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset to start of day for fair comparison

            // Skip if date is in the future
            if (parsedDate > today) {
              return;
            }

            updates.push({
              title: title.substring(0, 150),
              description: description || 'Adobe Customer Journey Analytics feature update',
              date: formatDate(dateMatch[0]),
              url: 'https://experienceleague.adobe.com/en/docs/analytics-platform/using/releases/latest'
            });
          }
        }
      });
    }

    console.log(`✓ Found ${updates.length} Adobe CJA updates`);
    return updates;

  } catch (error) {
    console.error('✗ Error scraping Adobe CJA:', error.message);
    return [];
  }
}

// Scraper for Google Analytics
async function scrapeGoogleAnalyticsUpdates() {
  try {
    console.log('Scraping Google Analytics updates...');
    const response = await axios.get('https://support.google.com/analytics/answer/9164320', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AnalyticsTracker/1.0)'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const updates = [];

    // Google Analytics structure: h2 with date (e.g., "December 12, 2025")
    // followed by h3 with feature name (e.g., "Analytics Advisor")
    // followed by p with description
    $('h2').each((i, elem) => {
      if (updates.length >= 20) return false;

      const h2Text = $(elem).text().trim();

      // Check if this h2 is a date
      const dateMatch = h2Text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i);

      if (dateMatch) {
        const date = formatDate(dateMatch[0]);

        // Find the next h3 siblings after this h2
        let nextElem = $(elem).next();
        while (nextElem.length && !nextElem.is('h2')) {
          if (nextElem.is('h3')) {
            const featureName = nextElem.text().trim();

            // Get description from following paragraph (skip over any div.no-margin alert blocks)
            const descP = nextElem.nextAll('p').first();
            const description = descP.text().trim().substring(0, 250);

            // Skip if feature name is just a date pattern (e.g., "September 24, 2025")
            const isDatePattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}$/i.test(featureName);

            // Skip if no meaningful title or description
            if (featureName && featureName.length > 3 && !isDatePattern && description && description.length > 20) {
              updates.push({
                title: featureName.substring(0, 150),
                description: description,
                date: date,
                url: 'https://support.google.com/analytics/answer/9164320'
              });
            }
          }

          nextElem = nextElem.next();
        }
      }
    });

    console.log(`✓ Found ${updates.length} Google Analytics updates`);
    return updates;

  } catch (error) {
    console.error('✗ Error scraping Google Analytics:', error.message);
    return [];
  }
}

// Main scrape function
async function scrapeUpdates() {
  console.log('Starting competitor data scrape...');
  console.log('=====================================\n');

  const data = loadExistingData();
  let totalNewUpdates = 0;

  try {
    // Scrape each competitor
    const scrapers = [
      { id: 'amplitude', fn: scrapeAmplitudeUpdates },
      { id: 'adobe-cja', fn: scrapeAdobeCJAUpdates },
      { id: 'google-analytics', fn: scrapeGoogleAnalyticsUpdates }
    ];

    for (const scraper of scrapers) {
      try {
        const newUpdates = await scraper.fn();

        // Find competitor in data
        const competitorData = data.competitors.find(c => c.id === scraper.id);
        if (!competitorData) {
          console.log(`  ⚠ Competitor ${scraper.id} not found in data structure\n`);
          continue;
        }

        // Add new updates
        let addedCount = 0;
        for (const update of newUpdates) {
          if (!updateExists(competitorData.updates, update)) {
            competitorData.updates.unshift(update);
            addedCount++;
          }
        }

        // Keep only last 100 updates
        if (competitorData.updates.length > 100) {
          competitorData.updates = competitorData.updates.slice(0, 100);
        }

        if (addedCount > 0) {
          console.log(`  → Added ${addedCount} new updates\n`);
          totalNewUpdates += addedCount;
        } else {
          console.log(`  → No new updates found\n`);
        }

        // Be respectful with delays between requests
        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        console.error(`✗ Error scraping ${scraper.id}:`, error.message);
      }
    }

    saveData(data);

    console.log('=====================================');
    console.log(`Scrape completed successfully`);
    console.log(`Total new updates added: ${totalNewUpdates}`);
    console.log('=====================================');

  } catch (error) {
    console.error('Fatal error during scraping:', error.message);
    // Still save the data with updated timestamp even if scraping fails
    saveData(data);
  }
}

// Run scraper
scrapeUpdates().catch(console.error);
