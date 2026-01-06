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
      'https://experienceleague.adobe.com/en/docs/analytics-platform/using/releases/2025'
    ]
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    urls: [
      'https://amplitude.com/releases'
    ]
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    urls: [
      'https://docs.mixpanel.com/changelogs'
    ]
  },
  {
    id: 'piwik-pro',
    name: 'Piwik Pro',
    urls: [
      'https://piwik.pro/blog/category/news-releases/'
    ]
  },
  {
    id: 'matomo',
    name: 'Matomo',
    urls: [
      'https://matomo.org/changelog/'
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

// Helper to check if update exists
function updateExists(updates, newUpdate) {
  return updates.some(u =>
    u.title.toLowerCase().trim() === newUpdate.title.toLowerCase().trim() &&
    u.date === newUpdate.date
  );
}

// Scraper for Matomo
async function scrapeMatomoUpdates() {
  try {
    console.log('Scraping Matomo changelog...');
    const response = await axios.get('https://matomo.org/changelog/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AnalyticsTracker/1.0)'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const updates = [];

    // Matomo lists versions with links
    $('.entry-content a[href*="/changelog/matomo-"]').each((i, elem) => {
      if (i >= 20) return false; // Limit to 20 most recent

      const text = $(elem).text().trim();
      const url = $(elem).attr('href');

      // Parse "Matomo 5.1.2 – 28th October 2025"
      const match = text.match(/Matomo\s+([\d.]+)\s*[–-]\s*(.+)/i);

      if (match) {
        const version = match[1];
        const dateStr = match[2];

        updates.push({
          title: `Matomo ${version} Release`,
          description: `New version ${version} of Matomo has been released`,
          date: formatDate(dateStr),
          url: url || 'https://matomo.org/changelog/'
        });
      }
    });

    console.log(`✓ Found ${updates.length} Matomo updates`);
    return updates;

  } catch (error) {
    console.error('✗ Error scraping Matomo:', error.message);
    return [];
  }
}

// Scraper for Piwik Pro
async function scrapePiwikProUpdates() {
  try {
    console.log('Scraping Piwik Pro blog...');
    const response = await axios.get('https://piwik.pro/blog/category/news-releases/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AnalyticsTracker/1.0)'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const updates = [];

    // Find blog post articles
    $('article.post, .post-item, article').each((i, elem) => {
      if (i >= 15) return false; // Limit to 15 most recent

      const title = $(elem).find('h2, h3, .post-title, .entry-title').first().text().trim();
      const link = $(elem).find('a').first().attr('href');
      const dateElem = $(elem).find('time, .date, .post-date').first();
      const dateStr = dateElem.attr('datetime') || dateElem.text().trim();
      const excerpt = $(elem).find('.excerpt, .post-excerpt, p').first().text().trim();

      if (title && title.length > 5) {
        updates.push({
          title: title.substring(0, 150),
          description: excerpt.substring(0, 250) || 'Piwik Pro news and updates',
          date: formatDate(dateStr),
          url: link && link.startsWith('http') ? link : `https://piwik.pro${link || ''}`
        });
      }
    });

    console.log(`✓ Found ${updates.length} Piwik Pro updates`);
    return updates;

  } catch (error) {
    console.error('✗ Error scraping Piwik Pro:', error.message);
    return [];
  }
}

// Scraper for Google Analytics (RSS feed)
async function scrapeGoogleAnalyticsUpdates() {
  try {
    console.log('Scraping Google Analytics updates...');

    // Google Analytics doesn't have a clean changelog page
    // We'll use their release notes page
    const response = await axios.get('https://support.google.com/analytics/answer/9164320', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AnalyticsTracker/1.0)'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const updates = [];

    // Look for release note entries
    $('h2, h3').each((i, elem) => {
      if (i >= 15) return false;

      const title = $(elem).text().trim();
      const nextP = $(elem).next('p').text().trim();

      // Try to find dates in the heading or following text
      const dateMatch = title.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i);

      if (title.length > 10 && (title.includes('2024') || title.includes('2025') || dateMatch)) {
        updates.push({
          title: title.substring(0, 150),
          description: nextP.substring(0, 250) || 'Google Analytics update',
          date: dateMatch ? formatDate(dateMatch[0]) : new Date().toISOString().split('T')[0],
          url: 'https://support.google.com/analytics/answer/9164320'
        });
      }
    });

    console.log(`✓ Found ${updates.length} Google Analytics updates`);
    return updates;

  } catch (error) {
    console.error('✗ Error scraping Google Analytics:', error.message);
    return [];
  }
}

// Generic scraper for client-side rendered pages (fallback)
async function scrapeGenericUpdates(competitorId, name, url) {
  try {
    console.log(`Scraping ${name}...`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AnalyticsTracker/1.0)'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const updates = [];

    // Try common changelog patterns
    const selectors = [
      'article', '.release', '.changelog-item', '.update-item',
      '.post', '.entry', '[class*="release"]', '[class*="changelog"]'
    ];

    for (const selector of selectors) {
      $(selector).each((i, elem) => {
        if (i >= 10) return false;

        const title = $(elem).find('h1, h2, h3, h4, .title, [class*="title"]').first().text().trim();
        const description = $(elem).find('p, .description, [class*="description"]').first().text().trim();
        const link = $(elem).find('a').first().attr('href');

        if (title && title.length > 5) {
          updates.push({
            title: title.substring(0, 150),
            description: description.substring(0, 250) || `${name} update`,
            date: new Date().toISOString().split('T')[0],
            url: link && link.startsWith('http') ? link : url
          });
        }
      });

      if (updates.length > 0) break;
    }

    console.log(`✓ Found ${updates.length} ${name} updates`);
    return updates;

  } catch (error) {
    console.error(`✗ Error scraping ${name}:`, error.message);
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
      { id: 'matomo', fn: scrapeMatomoUpdates },
      { id: 'piwik-pro', fn: scrapePiwikProUpdates },
      { id: 'google-analytics', fn: scrapeGoogleAnalyticsUpdates },
      { id: 'adobe-cja', fn: () => scrapeGenericUpdates('adobe-cja', 'Adobe CJA', competitors[1].urls[0]) },
      { id: 'amplitude', fn: () => scrapeGenericUpdates('amplitude', 'Amplitude', competitors[2].urls[0]) },
      { id: 'mixpanel', fn: () => scrapeGenericUpdates('mixpanel', 'Mixpanel', competitors[3].urls[0]) }
    ];

    for (const scraper of scrapers) {
      try {
        const newUpdates = await scraper.fn();

        // Find competitor in data
        const competitorData = data.competitors.find(c => c.id === scraper.id);
        if (!competitorData) continue;

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
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error scraping ${scraper.id}:`, error.message);
      }
    }

    saveData(data);

    console.log('=====================================');
    console.log(`Scrape completed successfully`);
    console.log(`Total new updates added: ${totalNewUpdates}`);
    console.log('=====================================');

  } catch (error) {
    console.error('Error during scraping:', error.message);
    // Still save the data with updated timestamp even if scraping fails
    saveData(data);
  }
}

// Run scraper
scrapeUpdates().catch(console.error);
