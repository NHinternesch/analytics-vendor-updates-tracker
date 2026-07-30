# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An automated tracker for monitoring news and product releases from three major analytics competitors: Google Analytics, Adobe CJA, and Amplitude. Designed for GitHub Pages deployment with automated daily scraping via GitHub Actions.

## Commands

### Development
```bash
npm install              # Install dependencies (axios, cheerio)
npm run dev             # Start dev server at http://localhost:3000
```

### Data Collection
```bash
npm run scrape          # Update data/updates.json with latest competitor data
npm run health          # Exit non-zero if any source returned too few items
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

**3. Data Scraper (`scraper.js` + `scripts/sources/` + `scripts/lib/`)**
- Loads existing `data/updates.json` or initializes from the source registry
- Delegates fetching to one adapter per vendor in `scripts/sources/`
- Merges into the stored feed — never deletes, so one broken vendor cannot wipe data
- Enforces 100-update limit per competitor and logs what aged out
- **Only writes the file when feed content actually changed** (see below)
- Writes `data/health.json` (gitignored) for the workflow's health gate

**4. Health Gate (`check-health.js`)**
- Reads `data/health.json` and exits 1 if any source came back under its `minExpected`
- Runs as the *last* workflow step, after deploy, so a broken vendor turns the run
  red without blocking the vendors that still work

#### Why the health gate exists

The original scraper caught every error and returned `[]`. When Amplitude
redesigned its releases page in June 2026, the scraper silently found 0 items and
the workflow reported success for ~6 weeks. Nothing in the pipeline could tell
"no news today" apart from "totally broken". Any new source **must** declare a
`minExpected` floor so that failure mode cannot recur.

#### Why writes are conditional

`lastUpdated` used to be rewritten on every run, so `git diff` always reported a
change and the workflow committed daily no matter what. 49 of every 60 data
commits changed nothing but the timestamp. The scraper now fingerprints the
`competitors` array and skips the write entirely when nothing moved, which makes
`lastUpdated` mean "when the feed last actually changed" and makes git history a
usable record of vendor activity.

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

Create a module in `scripts/sources/` exporting the source shape, then register it
in `scripts/sources/index.js`. No other wiring is needed — the scraper initializes
the vendor in `data/updates.json` on the next run.

```javascript
export default {
  id: 'new-competitor',            // stable slug, also the UI filter key
  name: 'New Competitor Name',     // display name
  homepage: 'https://example.com/releases',
  minExpected: 5,                  // health floor — REQUIRED, see below
  dedupeBy: 'url',                 // 'url' if URLs are per-item permalinks,
                                   // otherwise omit for the 'url+title' default
  async fetchUpdates() {
    // return [{ title, description, date: 'YYYY-MM-DD', url }]
  }
};
```

Rules for a new source:
- **Prefer a feed or a docs source over HTML.** Marketing pages get redesigned; the
  git history has five "fix scraper for new page structure" commits to prove it.
- **Set a realistic `minExpected`.** This is the only thing standing between you and
  another six weeks of silent failure.
- **Throw on structural breakage.** If the parser cannot find the container it
  expects, throw rather than returning a short list.
- **Never invent a date.** `parseDate` returns null on failure; drop the item.

### Data Sources

**Amplitude** — `https://amplitude.com/releases/feed.xml` (RSS)
- ~200 entries with per-release permalinks, descriptions and real `pubDate`s
- Replaced HTML scraping in July 2026; no per-item detail fetches needed

**Adobe CJA** — `raw.githubusercontent.com/AdobeDocs/analytics-platform.en/.../latest.md`
- Reads the Markdown source Adobe authors in the open, not the rendered page
- Parses the feature table; stops at "Postponed features"
- Prefers the rollout date, falls back to GA date, skips unreleased rows
- Covers the current release cycle only (one month at a time)
- Per-item URLs are partial: uses the feature's documentation link when a row
  provides an absolute one, else the release-notes page. Adobe exposes no
  per-feature anchors, and the repo-relative `/help/*.md` paths 404 publicly.

**Google Analytics** — `https://support.google.com/analytics/answer/9164320`
- No feed exists, so this one still parses HTML — but it's a support page, the most
  stable of the three
- Dated `h2` headings carry ids (`id="07282026"`) used to build per-date deep links
- Several `h3` features share one date anchor, hence `dedupeBy: 'url+title'`

**Shared behaviour:**
- Max 100 updates per vendor; overflow is logged, never silently dropped
- Identity is `url` or `url+title` per source, so a repeated title like
  "Bug fixes" survives as its own entry instead of being swallowed
- Entries stored before deep links existed are upgraded in place by title match
- 1.5-second delay between sources; two retries with backoff on transient errors
- A failing source is skipped, not fatal — other vendors still merge and deploy

## GitHub Actions & Deployment

### Workflow Configuration

The project includes `.github/workflows/update-and-deploy.yml` which:

- **Runs daily at 2 AM UTC** via cron schedule
- **Can be triggered manually** via workflow_dispatch
- **Runs on every push to main** for immediate deployment

The workflow automatically:
1. Installs dependencies
2. Runs the scraper, which updates `data/updates.json` **only if content changed**
3. Commits data changes back to the repository (no commit on a no-change day)
4. Builds the static site
5. Deploys to GitHub Pages
6. Runs the health gate — **fails the run** if any source came back short

Step 6 is deliberately last. A red run therefore means "a scraper needs fixing",
not "the deploy failed"; the site is already live with whatever data did work.
Check the run's Summary tab for the per-source table.

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
npm run health  # Verify every source came back healthy
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
- **No fabricated data**: `lib/dates.js` returns null rather than guessing. An item
  with an unparseable date is dropped, never dated "today"
- **UTC dates**: `"Month D, YYYY"` is built with `Date.UTC` so a local timezone
  offset cannot shift the calendar day backwards on serialization
- **Merges are additive**: the scraper never removes stored entries except via the
  100-item cap, so a vendor outage cannot erase history
- **Live site**: https://nhinternesch.github.io/analytics-vendor-updates-tracker
