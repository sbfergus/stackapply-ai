# StackApply AI Scraper Architecture

## ⚠️ Note: LinkedIn Profile Scraping Removed

**LinkedIn profile scraping has been removed** from this extension and replaced with a resume PDF upload approach on the web app.

This architecture document now focuses on **job listing scrapers only**.

---

## Overview

This extension uses a **modular scraper architecture** to handle multiple job boards. Each scraper is optimized for its target site using **structural selectors** (IDs, semantic HTML, JSON-LD) rather than fragile CSS classes.

## Architecture

```
extension/
├── scrapers/               # Individual scraper modules (reference only)
│   ├── core.js            # Shared utilities
│   ├── linkedin-jobs.js   # LinkedIn job listings
│   ├── indeed-jobs.js     # Indeed job listings
│   ├── ziprecruiter-jobs.js # ZipRecruiter job listings
│   └── generic-jobs.js    # Fallback for other boards
├── content.js             # Main content script (contains all scrapers inline)
└── popup.js               # Extension UI logic
```

**Note:** The `scrapers/` directory contains the **source modules** for reference and future bundling. Currently, all scraper code is **compiled inline** into `content.js` because Chrome extensions don't support ES modules in content scripts without a bundler. The `linkedin-profile.js` module has been removed.

## Scraping Strategy

### 3-Tier Approach (All Scrapers)

1. **JSON-LD Schema** - Most reliable (job boards embed structured data)
2. **Page Title Parsing** - Medium reliability (common pattern: "Title | Company")
3. **DOM Selectors** - Fallback (structural selectors, not class names)

### Selector Principles

✅ **Use:**
- `section[id*="experience"]` - ID substring matching
- `section[aria-labelledby*="about"]` - Semantic attributes
- `a[href*="/company/"]` - Structural patterns
- `h1`, `h2` - Semantic HTML
- `getComputedStyle()` - Visual patterns (bold = title)
- JSON-LD structured data

❌ **Avoid:**
- `.pv-text-details__left-panel` - Minified classes
- `.text-heading-xlarge` - Site-specific classes
- `.artdeco-list__item` - Frequently changing classes

## Supported Sites

| Site | Status | Scraper | Detection Pattern |
|------|--------|---------|------------------|
| LinkedIn Jobs | ✅ Primary | `scrapeLinkedInJob()` | `/jobs/view/` |
| Indeed | ✅ Primary | `scrapeIndeedJob()` | `/viewjob`, `/rc/clk` |
| ZipRecruiter | ✅ Primary | `scrapeZipRecruiterJob()` | `/c/`, `/jobs/` |
| Glassdoor | 🟡 Generic | `scrapeGenericJob()` | `glassdoor.com` |
| Monster | 🟡 Generic | `scrapeGenericJob()` | `monster.com` |
| Dice | 🟡 Generic | `scrapeGenericJob()` | `dice.com` |
| Wellfound | 🟡 Generic | `scrapeGenericJob()` | `wellfound.com`, `angel.co` |
| Lever | 🟡 Generic | `scrapeGenericJob()` | `lever.co` |
| Greenhouse | 🟡 Generic | `scrapeGenericJob()` | `greenhouse.io` |
| Other | 🟡 Generic | `scrapeGenericJob()` | Fallback |

**Note:** LinkedIn Profile scraping was removed. Users now upload their resume PDFs via the web app.

## Data Schema

### Job Listing
```javascript
{
  title: string,
  company: string,
  location: string,
  workSetting: 'REMOTE' | 'HYBRID' | 'IN_OFFICE',
  salaryMin: number | null,
  salaryMax: number | null,
  techStack: string[],
  roleSummary: string,      // First 400 chars
  companyOverview: string,  // First 250 chars
  originalUrls: string[],
  sources: string[]
}
```

## Adding a New Scraper

1. Create a new file in `scrapers/` (e.g., `glassdoor-jobs.js`)
2. Import utilities from `core.js`
3. Follow the 3-tier strategy (JSON-LD → Title → DOM)
4. Use structural selectors, not class names
5. Add detection pattern to `detectSiteType()` in `core.js`
6. Compile into `content.js` (inline for now, or set up bundler)

## Future Improvements

- [ ] Set up Webpack/Rollup bundler for ES modules
- [ ] Add Playwright for dynamic content scraping
- [ ] Implement scraper unit tests
- [ ] Add scraper success rate metrics
- [ ] Support site-specific authentication flows
- [ ] Add OCR for job postings in images
