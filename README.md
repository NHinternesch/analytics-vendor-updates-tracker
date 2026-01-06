# Analytics Competition Updates Tracker

A lightweight, automated tracker for monitoring news and product releases from three major analytics competitors: Google Analytics, Adobe CJA, and Amplitude.

## Features

- **Real-time Search**: Search across competitor names, titles, and descriptions
- **Competitor Filtering**: Filter updates by competitor with update counts
- **Last Update Timestamp**: See when data was last refreshed (updated daily via GitHub Actions)
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Automated Daily Scraping**: GitHub Actions workflow runs daily to fetch latest updates
- **GitHub Pages Deployment**: Automatically deployed and hosted on GitHub Pages

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no dependencies)
- **Backend**: Node.js with Axios and Cheerio for web scraping
- **Deployment**: GitHub Pages + GitHub Actions
- **Data**: JSON-based updates stored in `data/updates.json`

## Tracked Competitors

| Competitor | Source | Updates Tracked |
|------------|--------|-----------------|
| **Google Analytics** | [Release Notes](https://support.google.com/analytics/answer/9164320) | ~20 recent updates |
| **Adobe CJA** | [Release Notes](https://experienceleague.adobe.com/en/docs/analytics-platform/using/releases/latest) | ~20 features |
| **Amplitude** | [Product Releases](https://amplitude.com/releases) | ~35 releases |

## Setup

### Prerequisites
- Node.js 18+
- GitHub account with repository access

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/NHinternesch/analytics-vendor-updates-tracker.git
cd analytics-vendor-updates-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Run the scraper manually:
```bash
npm run scrape
```

4. Start the development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to view the tracker.

### GitHub Setup

1. Push the repository to GitHub (already done)
2. Enable GitHub Pages in repository settings:
   - Go to Settings → Pages
   - Under "Build and deployment", set Source to: **GitHub Actions**
3. The GitHub Actions workflow will automatically:
   - Run daily at 2 AM UTC
   - Scrape competitor websites
   - Update `data/updates.json`
   - Build and deploy to GitHub Pages

## Project Structure

```
.
├── public/              # Frontend files
│   ├── index.html      # Main application
│   └── logo.png        # Logo
├── scripts/            # Backend scripts
│   ├── scraper.js      # Web scraper
│   ├── server.js       # Dev server
│   └── build.js        # Build script for GitHub Pages
├── data/               # Data storage
│   └── updates.json    # Competitor updates (auto-updated)
├── dist/               # Built files for GitHub Pages
├── .github/workflows/  # GitHub Actions workflows
│   └── update-and-deploy.yml  # Daily scrape & deploy workflow
└── package.json        # Dependencies
```

## How It Works

1. **Daily Scraping**: GitHub Actions runs the scraper daily at 2 AM UTC
2. **Data Update**: Scraped data is saved to `data/updates.json`
3. **Build**: The build script embeds data into `dist/index.html`
4. **Deployment**: GitHub Pages automatically serves the updated site

## Scraping Implementation

Each competitor has a custom scraper:

- **Amplitude**: Parses release links and extracts titles, dates (e.g., "Nov 25"), and categories
- **Adobe CJA**: Scrapes feature table rows with descriptions
- **Google Analytics**: Extracts h2/h3 headings with full date strings

All scrapers:
- Deduplicate updates by title + date
- Store max 100 updates per competitor
- Handle errors gracefully
- Include 1.5-second delays between requests

## Customization

### Add New Competitors

Edit `scripts/scraper.js` and:

1. Add to the `competitors` array:
```javascript
{
  id: 'new-competitor',
  name: 'New Competitor',
  urls: ['https://example.com/releases']
}
```

2. Create a custom scraper function:
```javascript
async function scrapeNewCompetitorUpdates() {
  // Implement scraping logic
}
```

3. Add to the scrapers list in `scrapeUpdates()` function

## Deployment

The application is automatically deployed to GitHub Pages when:
1. The daily GitHub Actions workflow runs (2 AM UTC)
2. Changes are pushed to the main branch
3. Manually triggered via Actions tab

Your site will be available at: `https://nhinternesch.github.io/analytics-vendor-updates-tracker/`

## License

MIT
