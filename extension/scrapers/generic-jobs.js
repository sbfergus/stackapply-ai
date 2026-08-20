/**
 * Generic Job Listing Scraper
 * Fallback for job boards not specifically supported
 * Uses heuristics and common patterns
 */

import { extractSalary, extractWorkSetting, extractTechStack, cleanText, extractJsonLd } from './core.js';

export function scrapeGenericJob() {
  console.log('🔍 Scraping generic job posting (fallback)...');
  
  const url = window.location.href;
  let source = 'Web';
  
  // Try to identify the source from URL
  if (url.includes('glassdoor.com')) source = 'Glassdoor';
  else if (url.includes('monster.com')) source = 'Monster';
  else if (url.includes('dice.com')) source = 'Dice';
  else if (url.includes('wellfound.com') || url.includes('angel.co')) source = 'Wellfound';
  else if (url.includes('lever.co')) source = 'Lever';
  else if (url.includes('greenhouse.io')) source = 'Greenhouse';
  else if (url.includes('workday.com')) source = 'Workday';
  else if (url.includes('bamboohr.com')) source = 'BambooHR';
  
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
    originalUrls: [url],
    sources: [source],
  };
  
  try {
    // TIER 1: Try JSON-LD (most job boards support this)
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
      
      if (jsonLd.description) {
        const fullText = cleanText(jsonLd.description);
        jobData.roleSummary = fullText.slice(0, 400) + '...';
        jobData.companyOverview = fullText.slice(0, 250) + '...';
      }
      
      if (jsonLd.baseSalary) {
        const salary = jsonLd.baseSalary.value || jsonLd.baseSalary;
        if (salary.minValue) jobData.salaryMin = salary.minValue;
        if (salary.maxValue) jobData.salaryMax = salary.maxValue;
      }
    }
    
    // TIER 2: Page title heuristics
    if (!jobData.title) {
      const docTitle = document.title || '';
      // Common patterns: "Job Title | Company", "Job Title - Company", "Job Title at Company"
      const separators = ['|', '-', ' at ', ' - '];
      
      for (const sep of separators) {
        if (docTitle.includes(sep)) {
          const parts = docTitle.split(sep).map(p => p.trim());
          if (!jobData.title && parts[0]) jobData.title = parts[0];
          if (!jobData.company && parts[1]) jobData.company = parts[1];
          break;
        }
      }
    }
    
    // TIER 3: Generic DOM heuristics
    
    // Title - First h1 is usually the job title
    if (!jobData.title) {
      const h1 = document.querySelector('h1');
      if (h1) jobData.title = h1.innerText.trim();
    }
    
    // Company - Look for common patterns
    if (!jobData.company) {
      // Try various semantic markers
      const companyEl = document.querySelector('[itemprop="hiringOrganization"]') ||
                       document.querySelector('[class*="company" i]') ||
                       document.querySelector('[class*="employer" i]') ||
                       document.querySelector('a[href*="/company/"]') ||
                       document.querySelector('a[href*="/companies/"]');
      
      if (companyEl) jobData.company = companyEl.innerText.trim();
    }
    
    // Location - Look for geo patterns
    if (!jobData.location) {
      const locationEl = document.querySelector('[itemprop="jobLocation"]') ||
                        document.querySelector('[class*="location" i]') ||
                        document.querySelector('[class*="city" i]');
      
      if (locationEl) {
        jobData.location = locationEl.innerText.trim();
      } else {
        // Pattern matching in text
        const allText = Array.from(document.querySelectorAll('span, div, p'));
        const locEl = allText.find(el => {
          const text = el.innerText || '';
          return /Remote|Hybrid|United States|Metropolitan|,\s*[A-Z]{2}|City/i.test(text) &&
                 text.length < 100;
        });
        if (locEl) jobData.location = locEl.innerText.trim();
      }
    }
    
    // Description - Look for main content
    if (!jobData.roleSummary) {
      const descEl = document.querySelector('[itemprop="description"]') ||
                    document.querySelector('[class*="description" i]') ||
                    document.querySelector('[class*="job-detail" i]') ||
                    document.querySelector('article') ||
                    document.querySelector('main');
      
      if (descEl) {
        const fullText = cleanText(descEl.innerText);
        jobData.roleSummary = fullText.slice(0, 400) + '...';
        jobData.companyOverview = fullText.slice(0, 250) + '...';
        
        // Extract metadata
        const { salaryMin, salaryMax } = extractSalary(fullText);
        jobData.salaryMin = salaryMin || jobData.salaryMin;
        jobData.salaryMax = salaryMax || jobData.salaryMax;
        jobData.workSetting = extractWorkSetting(fullText + ' ' + jobData.location);
        jobData.techStack = extractTechStack(fullText);
      }
    }
    
    // Clean up
    jobData.title = jobData.title.split('\n')[0].trim();
    jobData.company = jobData.company.split('\n')[0].trim();
    jobData.location = jobData.location.split('\n')[0].trim();
    
    console.log('✅ Generic job scraped:', jobData);
    return jobData;
    
  } catch (error) {
    console.error('❌ Generic job scraping error:', error);
    return jobData;
  }
}
