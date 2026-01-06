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

// Helper to check if update exists
function updateExists(updates, newUpdate) {
  return updates.some(u =>
    u.title.toLowerCase().trim() === newUpdate.title.toLowerCase().trim() &&
    u.date === newUpdate.date
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
    const updates = [];

    // Amplitude links have format: [emoji][title][date][category]
    // Example: "🔄TRC General AvailabilityNov 25"
    // Example: "📹Network Request and...TrackingNov 21Session Replay"
    $('a[href^="/releases/"]').each((i, elem) => {
      if (i >= 35) return false; // Limit to 35 most recent

      const href = $(elem).attr('href');
      if (!href || href === '/releases') return;

      const fullText = $(elem).text().trim();

      // Extract date pattern (e.g., "Nov 25", "Oct 31")
      // Note: In Amplitude's HTML, date is often attached to previous word without space
      const dateMatch = fullText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{1,2}/i);
      if (!dateMatch) return;

      // Split by date
      const parts = fullText.split(dateMatch[0]);
      if (parts.length < 1) return;

      // Part before date: emoji + title
      let titlePart = parts[0];
      // Remove emoji (first non-ASCII or non-alphanumeric character)
      titlePart = titlePart.replace(/^[\u{1F300}-\u{1F9FF}]/u, '').trim(); // Remove emoji
      titlePart = titlePart.replace(/^[^\w\s]+/, '').trim(); // Remove any other leading symbols

      // Part after date: category (if exists)
      const categoryPart = parts.length > 1 ? parts[1].trim() : '';

      // Skip if title is too short
      if (titlePart.length < 5) return;

      const date = parseRelativeDate(dateMatch[0]);
      const url = `https://amplitude.com${href}`;

      updates.push({
        title: titlePart.substring(0, 150),
        description: categoryPart ? `${categoryPart}: ${titlePart}` : `Amplitude product update: ${titlePart}`,
        date: date,
        url: url
      });
    });

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

    // Adobe uses a table structure for features
    // Look for <strong> tags which contain feature names
    $('strong').each((i, elem) => {
      if (i >= 20) return false; // Limit to 20 most recent

      const title = $(elem).text().trim();

      // Skip if too short or looks like a header
      if (title.length < 10 || title.includes(':') || title.match(/^(Feature|Description|Last update)/i)) {
        return;
      }

      // Find the containing row or paragraph
      const parent = $(elem).closest('tr, p');
      const description = parent.find('p').first().text().trim()
        .replace(/\s+/g, ' ')
        .substring(0, 250);

      // Try to find a date nearby
      const parentText = parent.text();
      const dateMatch = parentText.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i);

      updates.push({
        title: title.substring(0, 150),
        description: description || 'Adobe Customer Journey Analytics feature update',
        date: dateMatch ? formatDate(dateMatch[0]) : formatDate(new Date()),
        url: 'https://experienceleague.adobe.com/en/docs/analytics-platform/using/releases/latest'
      });
    });

    console.log(`✓ Found ${updates.length} Adobe CJA updates`);
    return updates;

  } catch (error) {
    console.error('✗ Error scraping Adobe CJA:', error.message);
    return [];
  }
}

// Scraper for Mixpanel
// NOTE: Mixpanel's changelog page is fully client-side rendered (React/Next.js)
// The static HTML returned by axios contains no changelog content
// Options to improve:
// 1. Use Puppeteer/Playwright for browser automation
// 2. Find their API endpoint (check network tab in browser)
// 3. Use RSS feed if available
async function scrapeMixpanelUpdates() {
  try {
    console.log('Scraping Mixpanel changelogs...');
    console.log('  ⚠ Note: Mixpanel uses client-side rendering - limited data available');

    const response = await axios.get('https://docs.mixpanel.com/changelogs', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AnalyticsTracker/1.0)'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const updates = [];

    // Since the page is client-rendered, try to find any embedded JSON data
    $('script[type="application/json"]').each((i, elem) => {
      try {
        const jsonText = $(elem).html();
        if (jsonText && jsonText.includes('changelog')) {
          // Try to parse and extract changelog data
          const jsonData = JSON.parse(jsonText);
          // This would require analyzing the actual JSON structure
          // which varies by site implementation
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });

    // Fallback: Look for any content that made it into static HTML
    $('h3 a, h3').each((i, elem) => {
      if (i >= 20) return false;

      const link = $(elem).is('a') ? $(elem) : $(elem).find('a').first();
      const title = link.text().trim() || $(elem).text().trim();
      const url = link.attr('href');

      if (!title || title.length < 5 || title.toLowerCase() === 'changelog') return;

      const dateElem = $(elem).is('h3') ? $(elem).prevAll('p').first() : link.closest('h3').prevAll('p').first();
      const dateStr = dateElem.text().trim();
      const descElem = $(elem).is('h3') ? $(elem).nextAll('p').first() : link.closest('h3').nextAll('p').first();
      const description = descElem.text().trim();

      const hasValidDate = dateStr.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i);

      if (title && hasValidDate) {
        updates.push({
          title: title.substring(0, 150),
          description: description.substring(0, 250) || 'Mixpanel product update',
          date: formatDate(dateStr),
          url: url && url.startsWith('/') ? `https://docs.mixpanel.com${url}` : (url || 'https://docs.mixpanel.com/changelogs')
        });
      }
    });

    console.log(`✓ Found ${updates.length} Mixpanel updates`);
    if (updates.length === 0) {
      console.log('  💡 Tip: Consider using Puppeteer for better results with client-rendered pages');
    }
    return updates;

  } catch (error) {
    console.error('✗ Error scraping Mixpanel:', error.message);
    return [];
  }
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

    // Matomo lists versions with links in format: "Matomo X.X.X – Date"
    $('.entry-content a[href*="/changelog/matomo-"], .entry-content a[href*="/changelog/piwik-"]').each((i, elem) => {
      if (i >= 25) return false; // Limit to 25 most recent

      const text = $(elem).text().trim();
      const url = $(elem).attr('href');

      // Parse "Matomo 5.1.2 – 28th October 2025" or "Piwik 3.x.x – Date"
      const match = text.match(/(Matomo|Piwik)\s+([\d.]+)\s*[–-]\s*(.+)/i);

      if (match) {
        const software = match[1];
        const version = match[2];
        const dateStr = match[3];

        updates.push({
          title: `${software} ${version} Release`,
          description: `New version ${version} of ${software} has been released`,
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
    $('article.post, .blog-post, article').each((i, elem) => {
      if (i >= 20) return false; // Limit to 20 most recent

      const title = $(elem).find('h2, h3, .post-title, .entry-title, a.post-link').first().text().trim();
      const link = $(elem).find('a').first().attr('href');
      const dateElem = $(elem).find('time, .date, .post-date, .published').first();
      const dateStr = dateElem.attr('datetime') || dateElem.text().trim();
      const excerpt = $(elem).find('.excerpt, .post-excerpt, .entry-summary, p').first().text().trim();

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

    // Look for h2/h3 headings that contain dates or version info
    $('h2, h3').each((i, elem) => {
      if (i >= 20) return false;

      const title = $(elem).text().trim();
      const nextP = $(elem).next('p, ul').text().trim();

      // Try to find dates in the heading
      const dateMatch = title.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i);

      // Include entries with dates or year references
      if (title.length > 10 && (dateMatch || title.match(/\b202[4-6]\b/))) {
        updates.push({
          title: title.substring(0, 150),
          description: nextP.substring(0, 250) || 'Google Analytics update',
          date: dateMatch ? formatDate(dateMatch[0]) : formatDate(new Date()),
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
      { id: 'mixpanel', fn: scrapeMixpanelUpdates },
      { id: 'matomo', fn: scrapeMatomoUpdates },
      { id: 'piwik-pro', fn: scrapePiwikProUpdates },
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
