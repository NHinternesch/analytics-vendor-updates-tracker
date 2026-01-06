# Analytics Competition Updates Tracker

A lightweight, automated tracker for monitoring news and product releases from six major analytics competitors: Google Analytics, Adobe CJA, Amplitude, Mixpanel, Piwik Pro, and Matomo.

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

## Setup

### Prerequisites
- Node.js 18+
- GitHub account with repository access

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/analytics-competition-tracker.git
cd analytics-competition-tracker
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

1. Push the repository to GitHub
2. Enable GitHub Pages in repository settings:
   - Go to Settings → Pages
   - Set source to "Deploy from a branch"
   - Select `gh-pages` branch
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
│   └── scrape.yml      # Daily scrape workflow
└── package.json        # Dependencies
```

## How It Works

1. **Daily Scraping**: GitHub Actions runs the scraper daily at 2 AM UTC
2. **Data Update**: Scraped data is saved to `data/updates.json`
3. **Build**: The build script embeds data into `dist/index.html`
4. **Deployment**: GitHub Pages automatically serves the updated site

## Customization

### Change Scrape Schedule
Edit `.github/workflows/scrape.yml` and modify the cron expression:
```yaml
schedule:
  - cron: '0 2 * * *'  # Change this line
```

### Add New Competitors
Edit `scripts/scraper.js` and add to the `competitors` array:
```javascript
{
  id: 'new-competitor',
  name: 'New Competitor',
  urls: ['https://example.com/releases']
}
```

### Customize Scraping Logic
Modify the scraping logic in `scripts/scraper.js` to parse specific websites and extract updates.

## Deployment

The application is automatically deployed to GitHub Pages when:
1. Changes are pushed to the main branch
2. The daily GitHub Actions workflow completes successfully

Your site will be available at: `https://yourusername.github.io/analytics-competition-tracker/`

## License

MIT
