/**
 * Core scraping utilities shared across all scrapers
 */

/**
 * Detect the current site type from URL
 */
export function detectSiteType(url) {
  if (url.includes('linkedin.com/in/')) return 'linkedin-profile';
  if (url.includes('linkedin.com/jobs/view/')) return 'linkedin-job';
  if (url.includes('indeed.com/viewjob')) return 'indeed-job';
  if (url.includes('indeed.com/rc/clk')) return 'indeed-job';
  if (url.includes('ziprecruiter.com/c/')) return 'ziprecruiter-job';
  if (url.includes('ziprecruiter.com/jobs/')) return 'ziprecruiter-job';
  return 'generic-job';
}

/**
 * Extract salary information from text
 */
export function extractSalary(text) {
  const salaryRegex = /\$(\d{2,3})[,\.]?(\d{3})?\s*(?:-|to)\s*\$(\d{2,3})[,\.]?(\d{3})?/i;
  const match = text.match(salaryRegex);
  
  if (match) {
    let min = parseInt(match[1].replace(/,/g, ''), 10);
    let max = parseInt(match[3].replace(/,/g, ''), 10);
    
    // Convert K format to full number
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    
    return { salaryMin: min, salaryMax: max };
  }
  
  return { salaryMin: null, salaryMax: null };
}

/**
 * Extract work setting from text
 */
export function extractWorkSetting(text) {
  const upperText = text.toUpperCase();
  
  if (upperText.includes('HYBRID')) return 'HYBRID';
  if (upperText.includes('ON-SITE') || upperText.includes('ONSITE') || upperText.includes('IN OFFICE')) {
    return 'IN_OFFICE';
  }
  return 'REMOTE';
}

/**
 * Extract tech stack from text
 */
export function extractTechStack(text) {
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

/**
 * Clean HTML and normalize whitespace
 */
export function cleanText(text) {
  return text
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]+/g, ' ')
    .trim();
}

/**
 * Find element by multiple selectors (fallback chain)
 */
export function findElement(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}

/**
 * Find elements by text content
 */
export function findByText(tagName, pattern) {
  const elements = Array.from(document.querySelectorAll(tagName));
  return elements.find(el => pattern.test(el.innerText || ''));
}

/**
 * Try to extract JSON-LD structured data (common on job boards)
 */
export function extractJsonLd(type = 'JobPosting') {
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
