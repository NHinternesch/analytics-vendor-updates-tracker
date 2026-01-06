# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An automated tracker for monitoring news and product releases from six major analytics competitors: Google Analytics, Adobe CJA, Amplitude, Mixpanel, Piwik Pro, and Matomo. Designed for GitHub Pages deployment with automated daily scraping via GitHub Actions.

## Commands

### Development
```bash
npm install              # Install dependencies (axios, cheerio)
npm run dev             # Start dev server at http://localhost:3000
```

### Data Collection
```bash
npm run scrape          # Update data/updates.json with latest competitor data
```

### Production Build
```bash
npm run build           # Build static site to dist/ with embedded data
```

## Architecture

### Three-Script System

The codebase separates concerns across three independent scripts in `scripts/`:

**1. Development Server (`server.js`)**
- Simple HTTP server for local development
- Serves static files from `public/`
- Provides `/api/updates` endpoint reading `data/updates.json`
- No build step required during development

**2. Production Build (`build.js`)**
- Reads `data/updates.json` and `public/index.html`
- **Critical pattern**: Embeds data as `window.__DATA__` inline in HTML
- Outputs static `dist/index.html` suitable for GitHub Pages (no API needed)
- Copies assets (logo.png) to `dist/`

**3. Data Scraper (`scraper.js`)**
- Loads existing `data/updates.json` or initializes with competitor structure
- Currently adds sample updates (real scraping logic needs implementation)
- Enforces 100-update limit per competitor
- Updates `lastUpdated` timestamp on every run

### Data Flow

```
Daily:  scraper.js → data/updates.json → [git commit] → GitHub Actions
Deploy: build.js → dist/index.html (with embedded data) → GitHub Pages

Dev:    data/updates.json ← server.js ← fetch('/api/updates') ← browser
```

### Frontend Architecture (`public/index.html`)

Single-file vanilla JavaScript application with no external dependencies:

**CompetitionTracker class** manages:
- Data loading: Checks for `window.__DATA__` (production) or fetches `/api/updates` (dev)
- State: `searchQuery`, `selectedCompetitor`, `allUpdates`, `filteredUpdates`
- Filtering: Real-time search across title/description/competitor + competitor selection
- Rendering: Imperative DOM updates based on filtered state

**Key methods**:
- `flattenUpdates()`: Transforms nested competitor structure into flat array with competitor metadata
- `filterUpdates()`: Applies search and competitor filters
- `render()`: Updates competitor list, feed, and empty states

## Data Structure

`data/updates.json` schema:

```javascript
{
  "competitors": [
    {
      "id": "competitor-slug",       // Used for filtering
      "name": "Display Name",         // Shown in UI
      "updates": [
        {
          "title": "Update Title",
          "description": "Description",
          "date": "YYYY-MM-DD",       // ISO date string
          "url": "https://source.com" // External link
        }
      ]
    }
  ],
  "lastUpdated": "2025-12-18T10:30:00Z"  // ISO 8601 timestamp
}
```

## Extending Functionality

### Adding Competitors

In `scripts/scraper.js`, add to the `competitors` array at the top:

```javascript
{
  id: 'new-competitor',
  name: 'New Competitor Name',
  urls: ['https://example.com/releases']
}
```

The scraper will automatically initialize the competitor in `data/updates.json`.

### Web Scraping Implementation

The scraper now fetches **real-time data** from competitor websites with custom parsers for each vendor:

**✅ Fully Working Scrapers:**
- **Amplitude** (https://amplitude.com/releases)
  - Parses 35+ release links with titles, dates, and categories
  - Extracts: emoji-prefixed titles, dates (e.g., "Nov 25"), and product categories
  - Smart date parsing handles relative dates and year detection

- **Google Analytics** (https://support.google.com/analytics/answer/9164320)
  - Extracts h2/h3 headings with dates (last 20)
  - Parses full dates like "December 12, 2025"

- **Adobe CJA** (https://experienceleague.adobe.com/en/docs/analytics-platform/using/releases/latest)
  - Scrapes feature table rows with descriptions (last 20)
  - Extracts: feature names in `<strong>` tags and detailed descriptions

**⚠️ Limited/Not Working:**
- **Mixpanel** (https://docs.mixpanel.com/changelogs)
  - Page is fully client-side rendered (React/Next.js)
  - Static HTML contains no changelog content
  - **Solution:** Would require Puppeteer/Playwright for browser automation

- **Matomo** & **Piwik Pro**
  - Scrapers implemented but may return 0 results depending on page structure
  - Basic HTML parsing with common selectors

**Time Period Scraped:**
- **Amplitude**: Last ~35 releases (typically covers 12-18 months)
- **Adobe CJA**: Last ~20 features (current release cycle)
- **Google Analytics**: Last ~20 updates (current year)
- **Others**: Up to 25 items from changelog pages
- No explicit date filtering - captures whatever is currently published
- Maximum 100 updates stored per competitor (older ones automatically dropped)

**Technical Details:**
- Uses `axios` for HTTP requests with 15-second timeout
- Parses HTML with `cheerio` (jQuery-like selectors)
- 1.5-second delay between requests to be respectful
- Graceful error handling - continues even if one competitor fails
- Automatic deduplication by title + date prevents duplicates
- Smart date parsing: handles "Nov 25" format and detects correct year

## GitHub Actions & Deployment

### Workflow Configuration

The project includes `.github/workflows/update-and-deploy.yml` which:

- **Runs daily at 2 AM UTC** via cron schedule
- **Can be triggered manually** via workflow_dispatch
- **Runs on every push to main** for immediate deployment

The workflow automatically:
1. Installs dependencies
2. Runs the scraper to update `data/updates.json`
3. Commits any data changes back to the repository
4. Builds the static site
5. Deploys to GitHub Pages

### Enabling GitHub Pages

After pushing to GitHub, enable Pages in repository settings:

1. Go to **Settings → Pages**
2. Under "Build and deployment":
   - Source: **GitHub Actions** (not Deploy from a branch)
3. The workflow will automatically deploy on the next run

Your site will be available at: `https://<username>.github.io/<repo-name>/`

### Manual Deployment

To trigger a deployment without waiting for the daily schedule:
1. Go to **Actions** tab in GitHub
2. Select **Update Data and Deploy** workflow
3. Click **Run workflow**

### Local Testing

Before deploying, test locally:
```bash
npm run scrape  # Update data
npm run build   # Build dist/
npm run dev     # Preview at localhost:3000
```

## Important Technical Details

- **ES Modules**: All scripts use `import`/`export`. `package.json` has `"type": "module"`
- **Path handling**: Scripts use `fileURLToPath(import.meta.url)` and `dirname()` for cross-platform path resolution
- **No frameworks**: Frontend is intentionally dependency-free for minimal bundle size
- **Static deployment**: Production build embeds all data inline to avoid API requirements on GitHub Pages
- **Update limits**: Scraper maintains max 100 updates per competitor to prevent unbounded growth
- **Skip CI**: Automated commits include `[skip ci]` to prevent infinite workflow loops
