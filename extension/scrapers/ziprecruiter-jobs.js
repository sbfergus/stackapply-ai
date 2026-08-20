/**
 * ZipRecruiter Job Listing Scraper
 */

import { extractSalary, extractWorkSetting, extractTechStack, cleanText, extractJsonLd } from './core.js';

export function scrapeZipRecruiterJob() {
  console.log('🔍 Scraping ZipRecruiter job posting...');
  
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
    sources: ['ZipRecruiter'],
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
    
    // TIER 2: ZipRecruiter-specific DOM selectors
    
    // Title
    if (!jobData.title) {
      const titleEl = document.querySelector('h1.job_title') ||
                     document.querySelector('h1[itemprop="title"]') ||
                     document.querySelector('h1');
      if (titleEl) jobData.title = titleEl.innerText.trim();
    }
    
    // Company
    if (!jobData.company) {
      const companyEl = document.querySelector('a.hiring_company_text') ||
                       document.querySelector('[itemprop="hiringOrganization"]') ||
                       document.querySelector('.job_header_company_name');
      if (companyEl) jobData.company = companyEl.innerText.trim();
    }
    
    // Location
    if (!jobData.location) {
      const locationEl = document.querySelector('.job_location') ||
                        document.querySelector('[itemprop="jobLocation"]') ||
                        document.querySelector('.location');
      if (locationEl) jobData.location = locationEl.innerText.trim();
    }
    
    // Salary
    if (!jobData.salaryMin) {
      const salaryEl = document.querySelector('.compensation_range') ||
                      document.querySelector('[itemprop="baseSalary"]') ||
                      document.querySelector('.salary');
      if (salaryEl) {
        const { salaryMin, salaryMax } = extractSalary(salaryEl.innerText);
        jobData.salaryMin = salaryMin;
        jobData.salaryMax = salaryMax;
      }
    }
    
    // Description
    if (!jobData.roleSummary) {
      const descEl = document.querySelector('.job_description') ||
                    document.querySelector('[itemprop="description"]') ||
                    document.querySelector('.jobDescriptionSection');
      
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
    
    console.log('✅ ZipRecruiter job scraped:', jobData);
    return jobData;
    
  } catch (error) {
    console.error('❌ ZipRecruiter job scraping error:', error);
    return jobData;
  }
}
