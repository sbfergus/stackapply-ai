/**
 * Indeed Job Listing Scraper
 * Indeed uses different class patterns than LinkedIn
 */

import { extractSalary, extractWorkSetting, extractTechStack, cleanText, extractJsonLd } from './core.js';

export function scrapeIndeedJob() {
  console.log('🔍 Scraping Indeed job posting...');
  
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
    sources: ['Indeed'],
  };
  
  try {
    // TIER 1: Try JSON-LD
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
    }
    
    // TIER 2: Indeed-specific DOM selectors
    
    // Title - Indeed uses data-testid attributes
    if (!jobData.title) {
      const titleEl = document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]') ||
                     document.querySelector('h1.jobsearch-JobInfoHeader-title') ||
                     document.querySelector('h1');
      if (titleEl) jobData.title = titleEl.innerText.trim();
    }
    
    // Company
    if (!jobData.company) {
      const companyEl = document.querySelector('[data-testid="inlineHeader-companyName"]') ||
                       document.querySelector('[data-company-name]') ||
                       document.querySelector('div[data-testid="jobsearch-CompanyInfoContainer"] a');
      if (companyEl) jobData.company = companyEl.innerText.trim();
    }
    
    // Location
    if (!jobData.location) {
      const locationEl = document.querySelector('[data-testid="job-location"]') ||
                        document.querySelector('[data-testid="jobsearch-JobInfoHeader-subtitle"] div:last-child') ||
                        document.querySelector('.jobsearch-JobInfoHeader-subtitle-location');
      if (locationEl) jobData.location = locationEl.innerText.trim();
    }
    
    // Salary - Indeed often shows this separately
    if (!jobData.salaryMin) {
      const salaryEl = document.querySelector('[id*="salaryInfoAndJobType"]') ||
                      document.querySelector('[data-testid*="salary"]') ||
                      document.querySelector('.salary-snippet');
      if (salaryEl) {
        const { salaryMin, salaryMax } = extractSalary(salaryEl.innerText);
        jobData.salaryMin = salaryMin;
        jobData.salaryMax = salaryMax;
      }
    }
    
    // Description
    if (!jobData.roleSummary) {
      const descEl = document.querySelector('[id="jobDescriptionText"]') ||
                    document.querySelector('.jobsearch-jobDescriptionText') ||
                    document.querySelector('[data-testid="jobsearch-JobComponent-description"]');
      
      if (descEl) {
        const fullText = cleanText(descEl.innerText);
        jobData.roleSummary = fullText.slice(0, 400) + '...';
        
        if (!jobData.companyOverview) {
          jobData.companyOverview = fullText.slice(0, 250) + '...';
        }
        
        // Extract metadata
        if (!jobData.salaryMin) {
          const { salaryMin, salaryMax } = extractSalary(fullText);
          jobData.salaryMin = salaryMin;
          jobData.salaryMax = salaryMax;
        }
        jobData.workSetting = extractWorkSetting(fullText + ' ' + jobData.location);
        jobData.techStack = extractTechStack(fullText);
      }
    }
    
    // Clean up
    jobData.title = jobData.title.split('\n')[0].trim();
    jobData.company = jobData.company.split('\n')[0].trim();
    jobData.location = jobData.location.split('\n')[0].trim();
    
    console.log('✅ Indeed job scraped:', jobData);
    return jobData;
    
  } catch (error) {
    console.error('❌ Indeed job scraping error:', error);
    return jobData;
  }
}
