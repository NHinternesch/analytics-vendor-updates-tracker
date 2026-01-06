import axios from 'axios';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = new URL('.', import.meta.url).pathname;
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

// Scrape competitor updates
async function scrapeUpdates() {
  console.log('Starting competitor data scrape...');
  
  const data = loadExistingData();
  
  // For now, we'll keep the existing data structure
  // In a real implementation, you would scrape each competitor's website
  // and parse the HTML to extract updates
  
  try {
    // Example: Scrape Google Analytics
    console.log('Scraping Google Analytics...');
    // const gaResponse = await axios.get(competitors[0].urls[0], {
    //   headers: { 'User-Agent': 'Mozilla/5.0' }
    // });
    // Parse and extract updates from gaResponse.data
    
    // For demonstration, we'll add a sample update to show the system works
    const sampleUpdate = {
      title: 'Automated Scrape Update',
      description: `Data refreshed via automated scraper at ${new Date().toLocaleString()}`,
      date: new Date().toISOString().split('T')[0],
      url: 'https://support.google.com/analytics'
    };
    
    // Check if this update already exists
    const exists = data.competitors[0].updates.some(u => 
      u.title === sampleUpdate.title && u.date === sampleUpdate.date
    );
    
    if (!exists) {
      data.competitors[0].updates.unshift(sampleUpdate);
      // Keep only the last 100 updates per competitor
      if (data.competitors[0].updates.length > 100) {
        data.competitors[0].updates = data.competitors[0].updates.slice(0, 100);
      }
    }
    
    saveData(data);
    console.log('Scrape completed successfully');
    
  } catch (error) {
    console.error('Error during scraping:', error.message);
    // Still save the data with updated timestamp even if scraping fails
    saveData(data);
  }
}

// Run scraper
scrapeUpdates().catch(console.error);
