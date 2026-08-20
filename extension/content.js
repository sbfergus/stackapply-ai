/**
 * Content Script - Router
 * Delegates scraping to the appropriate specialized scraper
 * 
 * Note: This file loads all scrapers inline since Chrome extensions
 * don't support ES modules in content scripts without bundling
 */

console.log("⚡ StackApply AI: Content script loaded on page:", window.location.href);

// ========================================
// CORE UTILITIES
// ========================================

function detectSiteType(url) {
  if (url.includes('linkedin.com/in/')) return 'linkedin-profile';
  if (url.includes('linkedin.com/jobs/view/')) return 'linkedin-job';
  if (url.includes('indeed.com/viewjob')) return 'indeed-job';
  if (url.includes('indeed.com/rc/clk')) return 'indeed-job';
  if (url.includes('ziprecruiter.com/c/')) return 'ziprecruiter-job';
  if (url.includes('ziprecruiter.com/jobs/')) return 'ziprecruiter-job';
  return 'generic-job';
}

function extractSalary(text) {
  const salaryRegex = /\$(\d{2,3})[,\.]?(\d{3})?\s*(?:-|to)\s*\$(\d{2,3})[,\.]?(\d{3})?/i;
  const match = text.match(salaryRegex);
  
  if (match) {
    let min = parseInt(match[1].replace(/,/g, ''), 10);
    let max = parseInt(match[3].replace(/,/g, ''), 10);
    
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    
    return { salaryMin: min, salaryMax: max };
  }
  
  return { salaryMin: null, salaryMax: null };
}

function extractWorkSetting(text) {
  const upperText = text.toUpperCase();
  
  if (upperText.includes('HYBRID')) return 'HYBRID';
  if (upperText.includes('ON-SITE') || upperText.includes('ONSITE') || upperText.includes('IN OFFICE')) {
    return 'IN_OFFICE';
  }
  return 'REMOTE';
}

function extractTechStack(text) {
  const commonTech = [
    'React', 'Next.js', 'TypeScript', 'JavaScript', 'Node.js', 'Python',
    'PostgreSQL', 'Tailwind CSS', 'GraphQL', 'AWS', 'Docker', 'Prisma',
    'Java', 'Go', 'Ruby', 'Kubernetes', 'AEM', 'Target', 'HTML', 'CSS',
    'Svelte', 'Vue', 'Angular', 'SQL', 'CDK', 'Terraform', 'MongoDB',
    'Redis', 'Kafka', 'Jenkins', 'Git', 'REST', 'API', 'Microservices'
  ];
  
  return commonTech.filter(tech => 
    new RegExp(`\\b${tech}\\b`, 'i').test(text)
  );
}

function cleanText(text) {
  return text
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]+/g, ' ')
    .trim();
}

function extractJsonLd(type = 'JobPosting') {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.innerText);
      if (data['@type'] === type || data.title) {
        return data;
      }
    } catch (e) {
      // Ignore invalid JSON
    }
  }
  
  return null;
}

// ========================================
// JOB SCRAPERS
// ========================================

function scrapeLinkedInJob() {
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
          jobData.location = [locObj.address.addressLocality, locObj.address.addressRegion]
            .filter(Boolean).join(', ');
        }
      }
      
      jobData.roleSummary = jsonLd.description ? cleanText(jsonLd.description).slice(0, 400) + '...' : '';
    }
    
    // TIER 2: Page title
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
    
    // TIER 3: DOM
    if (!jobData.title) {
      const titleEl = document.querySelector('h1');
      if (titleEl) jobData.title = titleEl.innerText.trim();
    }
    
    if (!jobData.company) {
      const companyEl = document.querySelector('a[href*="/company/"]');
      if (companyEl) jobData.company = companyEl.innerText.trim();
    }
    
    if (!jobData.location) {
      const allSpans = Array.from(document.querySelectorAll('span'));
      const locSpan = allSpans.find(s => {
        const text = s.innerText || '';
        return text.includes('•') && /Remote|Hybrid|On-site|United States/i.test(text);
      });
      if (locSpan) {
        jobData.location = locSpan.innerText.split('•').map(p => p.trim()).filter(Boolean).join(', ');
      }
    }
    
    if (!jobData.roleSummary) {
      const descEl = document.querySelector('[data-testid="expandable-text-box"]') ||
                    document.querySelector('main');
      if (descEl) {
        const fullText = cleanText(descEl.innerText);
        jobData.roleSummary = fullText.slice(0, 400) + '...';
        jobData.companyOverview = fullText.slice(0, 250) + '...';
        
        const { salaryMin, salaryMax } = extractSalary(fullText);
        jobData.salaryMin = salaryMin;
        jobData.salaryMax = salaryMax;
        jobData.workSetting = extractWorkSetting(fullText);
        jobData.techStack = extractTechStack(fullText);
      }
    }
    
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

function scrapeIndeedJob() {
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
          jobData.location = [locObj.address.addressLocality, locObj.address.addressRegion]
            .filter(Boolean).join(', ');
        }
      }
      
      if (jsonLd.description) {
        const fullText = cleanText(jsonLd.description);
        jobData.roleSummary = fullText.slice(0, 400) + '...';
        jobData.companyOverview = fullText.slice(0, 250) + '...';
      }
    }
    
    if (!jobData.title) {
      const titleEl = document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]') ||
                     document.querySelector('h1');
      if (titleEl) jobData.title = titleEl.innerText.trim();
    }
    
    if (!jobData.company) {
      const companyEl = document.querySelector('[data-testid="inlineHeader-companyName"]') ||
                       document.querySelector('[data-company-name]');
      if (companyEl) jobData.company = companyEl.innerText.trim();
    }
    
    if (!jobData.location) {
      const locationEl = document.querySelector('[data-testid="job-location"]');
      if (locationEl) jobData.location = locationEl.innerText.trim();
    }
    
    if (!jobData.roleSummary) {
      const descEl = document.querySelector('[id="jobDescriptionText"]');
      if (descEl) {
        const fullText = cleanText(descEl.innerText);
        jobData.roleSummary = fullText.slice(0, 400) + '...';
        jobData.companyOverview = fullText.slice(0, 250) + '...';
        
        const { salaryMin, salaryMax } = extractSalary(fullText);
        jobData.salaryMin = salaryMin;
        jobData.salaryMax = salaryMax;
        jobData.workSetting = extractWorkSetting(fullText + ' ' + jobData.location);
        jobData.techStack = extractTechStack(fullText);
      }
    }
    
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

function scrapeZipRecruiterJob() {
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
          jobData.location = [locObj.address.addressLocality, locObj.address.addressRegion]
            .filter(Boolean).join(', ');
        }
      }
      
      if (jsonLd.description) {
        const fullText = cleanText(jsonLd.description);
        jobData.roleSummary = fullText.slice(0, 400) + '...';
        jobData.companyOverview = fullText.slice(0, 250) + '...';
      }
    }
    
    if (!jobData.title) {
      const titleEl = document.querySelector('h1.job_title') ||
                     document.querySelector('h1[itemprop="title"]') ||
                     document.querySelector('h1');
      if (titleEl) jobData.title = titleEl.innerText.trim();
    }
    
    if (!jobData.company) {
      const companyEl = document.querySelector('a.hiring_company_text') ||
                       document.querySelector('[itemprop="hiringOrganization"]');
      if (companyEl) jobData.company = companyEl.innerText.trim();
    }
    
    if (!jobData.location) {
      const locationEl = document.querySelector('.job_location') ||
                        document.querySelector('[itemprop="jobLocation"]');
      if (locationEl) jobData.location = locationEl.innerText.trim();
    }
    
    if (!jobData.roleSummary) {
      const descEl = document.querySelector('.job_description') ||
                    document.querySelector('[itemprop="description"]');
      if (descEl) {
        const fullText = cleanText(descEl.innerText);
        jobData.roleSummary = fullText.slice(0, 400) + '...';
        jobData.companyOverview = fullText.slice(0, 250) + '...';
        
        const { salaryMin, salaryMax } = extractSalary(fullText);
        jobData.salaryMin = salaryMin;
        jobData.salaryMax = salaryMax;
        jobData.workSetting = extractWorkSetting(fullText + ' ' + jobData.location);
        jobData.techStack = extractTechStack(fullText);
      }
    }
    
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

function scrapeGenericJob() {
  console.log('🔍 Scraping generic job posting (fallback)...');
  
  const url = window.location.href;
  let source = 'Web';
  
  if (url.includes('glassdoor.com')) source = 'Glassdoor';
  else if (url.includes('monster.com')) source = 'Monster';
  else if (url.includes('dice.com')) source = 'Dice';
  else if (url.includes('wellfound.com') || url.includes('angel.co')) source = 'Wellfound';
  else if (url.includes('lever.co')) source = 'Lever';
  else if (url.includes('greenhouse.io')) source = 'Greenhouse';
  
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
          jobData.location = [locObj.address.addressLocality, locObj.address.addressRegion]
            .filter(Boolean).join(', ');
        }
      }
      
      if (jsonLd.description) {
        const fullText = cleanText(jsonLd.description);
        jobData.roleSummary = fullText.slice(0, 400) + '...';
        jobData.companyOverview = fullText.slice(0, 250) + '...';
      }
    }
    
    if (!jobData.title) {
      const docTitle = document.title || '';
      const separators = ['|', '-', ' at ', ' - '];
      
      for (const sep of separators) {
        if (docTitle.includes(sep)) {
          const parts = docTitle.split(sep).map(p => p.trim());
          if (!jobData.title && parts[0]) jobData.title = parts[0];
          if (!jobData.company && parts[1]) jobData.company = parts[1];
          break;
        }
      }
      
      if (!jobData.title) {
        const h1 = document.querySelector('h1');
        if (h1) jobData.title = h1.innerText.trim();
      }
    }
    
    if (!jobData.company) {
      const companyEl = document.querySelector('[itemprop="hiringOrganization"]') ||
                       document.querySelector('a[href*="/company/"]');
      if (companyEl) jobData.company = companyEl.innerText.trim();
    }
    
    if (!jobData.location) {
      const locationEl = document.querySelector('[itemprop="jobLocation"]');
      if (locationEl) jobData.location = locationEl.innerText.trim();
    }
    
    if (!jobData.roleSummary) {
      const descEl = document.querySelector('[itemprop="description"]') ||
                    document.querySelector('article') ||
                    document.querySelector('main');
      if (descEl) {
        const fullText = cleanText(descEl.innerText);
        jobData.roleSummary = fullText.slice(0, 400) + '...';
        jobData.companyOverview = fullText.slice(0, 250) + '...';
        
        const { salaryMin, salaryMax } = extractSalary(fullText);
        jobData.salaryMin = salaryMin;
        jobData.salaryMax = salaryMax;
        jobData.workSetting = extractWorkSetting(fullText + ' ' + jobData.location);
        jobData.techStack = extractTechStack(fullText);
      }
    }
    
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

// ========================================
// PROFILE SCRAPER
// ========================================

function scrapeLinkedInProfile() {
  // This function is defined in popup.js and injected via executeScript
  // We don't need it here in content.js
  throw new Error('Profile scraping handled via popup.js injection');
}

// ========================================
// ROUTER
// ========================================

function scrapeCurrentPage(action) {
  const url = window.location.href;
  const siteType = detectSiteType(url);
  
  console.log(`⚡ StackApply AI: Detected site type: ${siteType}`);
  
  if (action === 'SCRAPE_PROFILE') {
    throw new Error('Profile scraping not supported in content script. Use popup.js injection.');
  }
  
  if (action === 'SCRAPE_JOB') {
    switch (siteType) {
      case 'linkedin-job':
        return scrapeLinkedInJob();
      
      case 'indeed-job':
        return scrapeIndeedJob();
      
      case 'ziprecruiter-job':
        return scrapeZipRecruiterJob();
      
      case 'linkedin-profile':
        throw new Error('Cannot scrape job from a profile page. Navigate to a job listing.');
      
      default:
        return scrapeGenericJob();
    }
  }
  
  throw new Error('Unknown action: ' + action);
}

// Extension message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("⚡ StackApply AI: Received message from popup:", request);
  
  try {
    const data = scrapeCurrentPage(request.action);
    sendResponse(data);
  } catch (error) {
    console.error("⚡ StackApply AI: Scraping error:", error);
    sendResponse({ error: error.message });
  }
  
  return true;
});