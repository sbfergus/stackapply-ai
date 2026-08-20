/**
 * LinkedIn Job Listing Scraper
 * Uses structural selectors and JSON-LD when available
 */

import { extractSalary, extractWorkSetting, extractTechStack, cleanText, extractJsonLd } from './core.js';

export function scrapeLinkedInJob() {
  console.log('🔍 Scraping LinkedIn job posting...');
  
  const jobData = {
    title: '',
    company: '',
    location: '',
    workSetting: 'REMOTE',
    salaryMin: null,
    salaryMax: null,
    techStack: [],
    roleSummary: '',
    companyOverview: '',
    originalUrls: [window.location.href],
    sources: ['LinkedIn'],
  };
  
  try {
    // TIER 1: Try JSON-LD structured data (most reliable)
    const jsonLd = extractJsonLd('JobPosting');
    if (jsonLd) {
      console.log('✅ Found JSON-LD JobPosting schema');
      
      jobData.title = jsonLd.title || jobData.title;
      
      if (jsonLd.hiringOrganization) {
        jobData.company = typeof jsonLd.hiringOrganization === 'string' 
          ? jsonLd.hiringOrganization 
          : jsonLd.hiringOrganization.name || jobData.company;
      }
      
      if (jsonLd.jobLocation) {
        const locObj = Array.isArray(jsonLd.jobLocation) ? jsonLd.jobLocation[0] : jsonLd.jobLocation;
        if (locObj?.address) {
          jobData.location = [
            locObj.address.addressLocality, 
            locObj.address.addressRegion
          ].filter(Boolean).join(', ');
        }
      }
      
      jobData.roleSummary = jsonLd.description ? cleanText(jsonLd.description).slice(0, 400) + '...' : '';
    }
    
    // TIER 2: Page title parsing
    if (!jobData.title || !jobData.company) {
      const docTitle = document.title || '';
      if (docTitle && docTitle.includes('|') && !docTitle.toLowerCase().includes('feed')) {
        const parts = docTitle.split('|').map(p => p.trim());
        if (!jobData.title && parts[0]) jobData.title = parts[0];
        if (!jobData.company && parts[1] && !parts[1].toLowerCase().includes('linkedin')) {
          jobData.company = parts[1];
        }
      }
    }
    
    // TIER 3: DOM scraping with structural selectors
    
    // Title - look for main heading
    if (!jobData.title) {
      const titleEl = document.querySelector('h1') || 
                     document.querySelector('[class*="job-title"]') ||
                     document.querySelector('h2.t-24');
      if (titleEl) jobData.title = titleEl.innerText.trim();
    }
    
    // Company - look for company link
    if (!jobData.company) {
      const companyEl = document.querySelector('a[href*="/company/"]') ||
                       document.querySelector('[class*="job-details-jobs-unified-top-card__company-name"]');
      if (companyEl) jobData.company = companyEl.innerText.trim();
    }
    
    // Location - look for geo patterns
    if (!jobData.location) {
      const locationEl = document.querySelector('[class*="job-details-jobs-unified-top-card__workplace-type"]') ||
                        document.querySelector('[class*="jobs-unified-top-card__bullet"]');
      
      if (locationEl) {
        jobData.location = locationEl.innerText.trim();
      } else {
        // Fallback: find spans with location-like text
        const allSpans = Array.from(document.querySelectorAll('span'));
        const locSpan = allSpans.find(s => {
          const text = s.innerText || '';
          return text.includes('•') && 
                 /Remote|Hybrid|On-site|United States|Metropolitan/i.test(text);
        });
        if (locSpan) {
          const parts = locSpan.innerText.split('•').map(p => p.trim());
          jobData.location = parts.filter(p => p.length > 0).join(', ');
        }
      }
    }
    
    // Description - look for main content area
    if (!jobData.roleSummary) {
      const descEl = document.querySelector('[class*="jobs-description-content__text"]') ||
                    document.querySelector('[class*="jobs-description__content"]') ||
                    document.querySelector('article') ||
                    document.querySelector('main');
      
      if (descEl) {
        const fullText = cleanText(descEl.innerText);
        jobData.roleSummary = fullText.slice(0, 400) + '...';
        jobData.companyOverview = fullText.slice(0, 250) + '...';
        
        // Extract metadata from full text
        const { salaryMin, salaryMax } = extractSalary(fullText);
        jobData.salaryMin = salaryMin;
        jobData.salaryMax = salaryMax;
        jobData.workSetting = extractWorkSetting(fullText);
        jobData.techStack = extractTechStack(fullText);
      }
    }
    
    // Clean up any multi-line values
    jobData.title = jobData.title.split('\n')[0].trim();
    jobData.company = jobData.company.split('\n')[0].trim();
    jobData.location = jobData.location.split('\n')[0].trim();
    
    console.log('✅ LinkedIn job scraped:', jobData);
    return jobData;
    
  } catch (error) {
    console.error('❌ LinkedIn job scraping error:', error);
    return jobData;
  }
}
