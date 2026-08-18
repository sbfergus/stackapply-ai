// ============================================
// API CONFIGURATION
// ============================================
// const API_BASE_URL = "${API_BASE_URL}";
const API_BASE_URL = "https://stackapply-ai.vercel.app"; // For local testing

// ============================================
// AUTHENTICATION HELPERS (from storage.js)
// ============================================

/**
 * Load authentication state from Chrome Storage
 */
async function loadAuthState() {
  return new Promise((resolve) => {
    chrome.storage.local.get('auth', (result) => {
      resolve(result.auth || null);
    });
  });
}

/**
 * Clear authentication state from Chrome Storage
 */
async function clearAuthState() {
  return new Promise((resolve) => {
    chrome.storage.local.remove('auth', () => {
      resolve();
    });
  });
}

/**
 * Validate token with API
 */
async function validateToken(token) {
  try {
    const response = await fetch('${API_BASE_URL}/api/auth/extension/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.success === true;
    }
    
    return false;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

// ============================================
// DOM CONTENT LOADED
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
  // Check authentication status first
  const authState = await loadAuthState();
  
  if (!authState || !authState.token) {
    // Not authenticated - redirect to auth screen
    window.location.href = 'popup-auth.html';
    return;
  }

  // Validate token with API
  const isValid = await validateToken(authState.token);
  if (!isValid) {
    // Token invalid/expired - clear and redirect to auth
    await clearAuthState();
    window.location.href = 'popup-auth.html';
    return;
  }

  // User is authenticated - proceed with normal popup functionality
  initializeAuthenticatedPopup(authState);
});

/**
 * Initialize popup for authenticated users
 */
async function initializeAuthenticatedPopup(authState) {
  const saveBtn = document.getElementById("save-btn");
  const statusEl = document.getElementById("status");
  const userHeaderEl = document.getElementById("user-header");
  const userEmailEl = document.getElementById("user-email");
  const guestBadgeEl = document.getElementById("guest-badge");
  const settingsBtn = document.getElementById("settings-btn");
  const settingsMenu = document.getElementById("settings-menu");
  const signoutBtn = document.getElementById("signout-btn");
  const switchAccountBtn = document.getElementById("switch-account-btn");

  // Show user header
  userHeaderEl.style.display = 'flex';

  // Display user info in header
  if (authState.isGuest) {
    userEmailEl.textContent = "Guest User";
    guestBadgeEl.style.display = 'inline-block';
  } else {
    userEmailEl.textContent = authState.user.email;
    guestBadgeEl.style.display = 'none';
  }

  // Settings menu toggle
  settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = settingsMenu.style.display === 'none';
    settingsMenu.style.display = isHidden ? 'block' : 'none';
  });
  
  // Close menu when clicking outside
  document.addEventListener("click", () => {
    settingsMenu.style.display = 'none';
  });

  // Close menu when clicking outside
  document.addEventListener("click", () => {
    if (!settingsMenu.classList.contains("hidden")) {
      settingsMenu.classList.add("hidden");
    }
  });

  // Sign out handler
  signoutBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await handleSignOut(authState.token);
  });

  // Switch account handler
  switchAccountBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await handleSignOut(authState.token);
  });

  let scrapedData = {};

  // Scrape job data from current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab?.id) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeJobDataInTab,
      });

      if (results && results[0] && results[0].result) {
        scrapedData = results[0].result;
        populateForm(scrapedData);
      }
    }
  } catch (err) {
    console.error("ExecuteScript error:", err);
  }

  function populateForm(data) {
    if (data.title) document.getElementById("title").value = data.title;
    if (data.company) document.getElementById("company").value = data.company;
    if (data.location) document.getElementById("location").value = data.location;
    if (data.workSetting) document.getElementById("workSetting").value = data.workSetting;
    if (data.salaryMin) document.getElementById("salaryMin").value = data.salaryMin;
    if (data.salaryMax) document.getElementById("salaryMax").value = data.salaryMax;
    if (data.roleSummary) document.getElementById("roleSummary").value = data.roleSummary;
    if (data.companyOverview) document.getElementById("companyOverview").value = data.companyOverview;
    
    if (data.techStack && Array.isArray(data.techStack)) {
      document.getElementById("techStack").value = data.techStack.join(", ");
    }
    if (data.benefits && Array.isArray(data.benefits)) {
      document.getElementById("benefits").value = data.benefits.join(", ");
    }
  }

  // Handle Save Button Click
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    const title = document.getElementById("title").value.trim();
    const company = document.getElementById("company").value.trim();
    const location = document.getElementById("location").value.trim();
    const selectedWorkSetting = document.getElementById("workSetting").value;
    const salaryMin = parseInt(document.getElementById("salaryMin").value, 10) || null;
    const salaryMax = parseInt(document.getElementById("salaryMax").value, 10) || null;
    const roleSummary = document.getElementById("roleSummary").value.trim();
    const companyOverview = document.getElementById("companyOverview").value.trim();
    const techStackInput = document.getElementById("techStack").value;
    const benefitsInput = document.getElementById("benefits").value;

    const techStack = techStackInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const benefits = benefitsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      ...scrapedData,
      title,
      company,
      location,
      workSetting: selectedWorkSetting,
      setting: selectedWorkSetting,
      workType: selectedWorkSetting,
      salaryMin,
      salaryMax,
      roleSummary,
      companyOverview,
      techStack,
      benefits,
    };

    const API_URL = `${API_BASE_URL}/api/jobs`;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authState.token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 401) {
        // Token expired - redirect to auth
        await clearAuthState();
        statusEl.innerText = "⚠️ Session expired. Please sign in again.";
        statusEl.className = "status error";
        setTimeout(() => {
          window.location.href = 'popup-auth.html';
        }, 1500);
        return;
      }

      if (res.ok && data.success) {
        statusEl.innerText = authState.isGuest 
          ? "✅ Saved to Guest Dashboard!" 
          : "✅ Saved to Your Dashboard!";
        statusEl.className = "status success";
        setTimeout(() => window.close(), 1200);
      } else if (res.status === 409) {
        statusEl.innerText = "Already in your dashboard";
        statusEl.className = "status error";
        saveBtn.disabled = false;
        saveBtn.innerText = "Save to Dashboard";
      } else {
        statusEl.innerText = "❌ Error: " + (data.message || data.error || "Failed to save");
        statusEl.className = "status error";
        saveBtn.disabled = false;
        saveBtn.innerText = "Save to Dashboard";
      }
    } catch (err) {
      console.error(err);
      statusEl.innerText = "❌ Could not connect to StackApply API";
      statusEl.className = "status error";
      saveBtn.disabled = false;
      saveBtn.innerText = "Save to Dashboard";
    }
  });
}

/**
 * Validate token with API
 */
async function validateToken(token) {
  try {
    const response = await fetch('${API_BASE_URL}/api/auth/extension/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

/**
 * Handle sign out
 */
async function handleSignOut(token) {
  try {
    // Call API to revoke token
    await fetch('${API_BASE_URL}/api/auth/extension/signout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (error) {
    console.error('Sign out error:', error);
  }
  
  // Clear local storage regardless of API result
  await clearAuthState();
  
  // Redirect to auth screen
  window.location.href = 'popup-auth.html';
}

// Self-contained scraper function injected directly into active tab
function scrapeJobDataInTab() {
  const url = window.location.href;
  
  // ============================================
  // JOB BOARD DETECTION
  // ============================================
  
  function detectJobBoard(url) {
    if (url.includes("linkedin.com")) return "LinkedIn";
    if (url.includes("indeed.com")) return "Indeed";
    if (url.includes("glassdoor.com")) return "Glassdoor";
    if (url.includes("ziprecruiter.com")) return "ZipRecruiter";
    if (url.includes("monster.com")) return "Monster";
    if (url.includes("dice.com")) return "Dice";
    if (url.includes("wellfound.com") || url.includes("angel.co")) return "Wellfound";
    if (url.includes("lever.co")) return "Lever";
    if (url.includes("greenhouse.io")) return "Greenhouse";
    return "Web";
  }
  
  const source = detectJobBoard(url);
  
  // ============================================
  // HELPER FUNCTIONS - Generic utilities
  // ============================================
  
  /**
   * Extract benefits from structured LinkedIn section
   */
  function extractLinkedInStructuredBenefits() {
    const benefits = [];
    const allParagraphs = Array.from(document.querySelectorAll('p'));
    const benefitsHeadingP = allParagraphs.find(p => 
      /^benefits\s+found\s+in\s+job\s+post$/i.test(p.innerText?.trim() || '')
    );
    
    if (benefitsHeadingP) {
      let nextElement = benefitsHeadingP.nextElementSibling;
      let attempts = 0;
      
      while (nextElement && attempts < 5) {
        const text = nextElement.innerText?.trim();
        
        if (text && text.length > 1 && text.length < 200) {
          if (!/^(about|see more|show more|promoted|posted|apply)/i.test(text)) {
            const benefitsList = text.split(/[,\n]/).map(b => b.trim()).filter(b => b.length > 1 && b.length < 100);
            
            if (benefitsList.length > 0) {
              return benefitsList;
            }
          }
        }
        
        nextElement = nextElement.nextElementSibling;
        attempts++;
      }
    }
    
    return benefits;
  }
  
  /**
   * Extract benefits from description text using pattern matching
   * Works for any job board
   */
  function extractBenefitsFromDescription(description) {
    const benefitPatterns = [
      { regex: /\bmedical\s+insurance\b/gi, name: 'Medical Insurance' },
      { regex: /\bdental\s+insurance\b/gi, name: 'Dental Insurance' },
      { regex: /\bdental\b(?!\s+insurance)/gi, name: 'Dental' },
      { regex: /\bvision\s+insurance\b/gi, name: 'Vision Insurance' },
      { regex: /\bvision\b(?!\s+insurance)/gi, name: 'Vision' },
      { regex: /\b401\(k\)\b/gi, name: '401(k)' },
      { regex: /\b401k\b/gi, name: '401(k)' },
      { regex: /\bemployer\s+match\b/gi, name: 'Employer Match' },
      { regex: /\bpaid\s+time\s+off\b/gi, name: 'Paid Time Off' },
      { regex: /\bpto\b/gi, name: 'PTO' },
      { regex: /\bvacation\b/gi, name: 'Vacation' },
      { regex: /\bholiday\s+program\b/gi, name: 'Holiday Program' },
      { regex: /\bparking\b/gi, name: 'Parking' },
      { regex: /\bfitness\b/gi, name: 'Fitness' },
      { regex: /\bgym\s+membership\b/gi, name: 'Gym Membership' },
      { regex: /\bemployee\s+discounts\b/gi, name: 'Employee Discounts' },
      { regex: /\blife\s+insurance\b/gi, name: 'Life Insurance' },
      { regex: /\bdisability\s+insurance\b/gi, name: 'Disability Insurance' },
      { regex: /\bparental\s+leave\b/gi, name: 'Parental Leave' },
      { regex: /\bstock\s+options\b/gi, name: 'Stock Options' },
      { regex: /\bequity\b/gi, name: 'Equity' },
      { regex: /\btuition\s+reimbursement\b/gi, name: 'Tuition Reimbursement' },
      { regex: /\bprofessional\s+development\b/gi, name: 'Professional Development' },
      { regex: /\bflexible\s+schedule\b/gi, name: 'Flexible Schedule' },
      { regex: /\bremote\s+work\b/gi, name: 'Remote Work' },
      { regex: /\bwork\s+from\s+home\b/gi, name: 'Work From Home' },
      { regex: /\bbonus\b/gi, name: 'Bonus' },
      { regex: /\bretirement\s+plan\b/gi, name: 'Retirement Plan' }
    ];
    
    const found = [];
    benefitPatterns.forEach(pattern => {
      if (pattern.regex.test(description)) {
        found.push(pattern.name);
      }
    });
    
    return found;
  }
  
  /**
   * Parse work setting from content
   */
  function parseWorkSetting(content) {
    const upperContent = content.toUpperCase();
    if (upperContent.includes("HYBRID")) {
      return "HYBRID";
    } else if (
      upperContent.includes("ON-SITE") ||
      upperContent.includes("ONSITE") ||
      upperContent.includes("IN-OFFICE") ||
      upperContent.includes("IN OFFICE")
    ) {
      return "IN_OFFICE";
    } else {
      return "REMOTE";
    }
  }
  
  /**
   * Extract salary range from text
   */
  function extractSalaryRange(text) {
    const salaryRegex = /\$(\d{2,3})[,\.]?(\d{3})?\s*(?:-|to)\s*\$(\d{2,3})[,\.]?(\d{3})?/i;
    const salaryMatch = text.match(salaryRegex);
    
    if (salaryMatch) {
      let rawMin = parseInt(salaryMatch[1].replace(/,/g, ""), 10);
      let rawMax = parseInt(salaryMatch[3].replace(/,/g, ""), 10);
      if (rawMin < 1000) rawMin *= 1000;
      if (rawMax < 1000) rawMax *= 1000;
      return { salaryMin: rawMin, salaryMax: rawMax };
    }
    
    return { salaryMin: null, salaryMax: null };
  }
  
  /**
   * Extract tech stack from description
   */
  function extractTechStack(description) {
    const techRules = [
      { name: "React", regex: /\bReact(?:\.js)?\b/i },
      { name: "Next.js", regex: /\bNext(?:\.js)?\b/i },
      { name: "TypeScript", regex: /\bTypeScript\b|\bTS\b/ },
      { name: "JavaScript", regex: /\bJavaScript\b|\bJS\b/ },
      { name: "Node.js", regex: /\bNode(?:\.js)?\b/i },
      { name: "Python", regex: /\bPython\b/i },
      { name: "PostgreSQL", regex: /\bPostgres(?:QL)?\b/i },
      { name: "Tailwind CSS", regex: /\bTailwind\b/i },
      { name: "GraphQL", regex: /\bGraphQL\b/i },
      { name: "AWS", regex: /\bAWS\b|\bAmazon Web Services\b/i },
      { name: "Docker", regex: /\bDocker\b/i },
      { name: "Prisma", regex: /\bPrisma\b/i },
      { name: "SQL", regex: /\bSQL\b/ },
      { name: "HTML", regex: /\bHTML5?\b/i },
      { name: "CSS", regex: /\bCSS3?\b/i },
      { name: "CDK", regex: /\bAWS CDK\b|\bCDK\b/ },
      { name: "Terraform", regex: /\bTerraform\b/i }
    ];

    return techRules
      .filter((rule) => rule.regex.test(description))
      .map((rule) => rule.name);
  }
  
  // ============================================
  // JOB BOARD-SPECIFIC SCRAPERS
  // ============================================
  
  /**
   * LinkedIn-specific scraper
   * Handles LinkedIn's unique DOM structure and data format
   */
  function scrapeLinkedIn() {
    let title = "";
    let company = "";
    let location = "";
    let description = "";
    let salaryMin = null;
    let salaryMax = null;
    let workSetting = "REMOTE";
    let roleSummary = "";
    let companyOverview = "";
    let benefits = [];
    let listedAt = null;
    
    // JSON-LD structured data
    const jsonLdScripts = Array.from(document.querySelectorAll("script[type='application/ld+json']"));
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.innerText);
        if (data["@type"] === "JobPosting" || data.title) {
          title = data.title || title;
          if (data.hiringOrganization) {
            company = typeof data.hiringOrganization === "string"
              ? data.hiringOrganization
              : data.hiringOrganization.name || company;
          }
          if (data.jobLocation) {
            const locObj = Array.isArray(data.jobLocation) ? data.jobLocation[0] : data.jobLocation;
            if (locObj?.address) {
              location = [locObj.address.addressLocality, locObj.address.addressRegion]
                .filter(Boolean)
                .join(", ");
            }
          }
          description = data.description || description;
          
          // Extract datePosted if available
          if (data.datePosted) {
            listedAt = new Date(data.datePosted).toISOString();
          }
        }
      } catch (e) {}
    }
    
    // Document title fallback
    if (!title || !company) {
      const docTitle = document.title || "";
      if (docTitle && docTitle.includes("|") && !docTitle.toLowerCase().includes("feed")) {
        const parts = docTitle.split("|").map((p) => p.trim());
        if (!title && parts[0]) title = parts[0];
        if (!company && parts[1] && !parts[1].toLowerCase().includes("linkedin")) company = parts[1];
      }
    }
    
    // DOM fallbacks
    if (!title) {
      title = document.querySelector("h1")?.innerText || "";
    }
    
    if (!company) {
      const companyAnchor = document.querySelector("a[href*='/company/']");
      if (companyAnchor) company = companyAnchor.innerText;
    }
    
    // Location extraction
    if (!location) {
      const spans = Array.from(document.querySelectorAll("span, p"));
      const cityStateRegex = /([A-Z][a-zA-Z\s]+,\s*[A-Z]{2})/;
      const locMatch = spans.find((s) => cityStateRegex.test(s.innerText || ""));
      if (locMatch) {
        const match = locMatch.innerText.match(cityStateRegex);
        if (match) location = match[1].trim();
      }
    }
    
    // Date extraction - look for "X days ago", "X weeks ago", etc.
    if (!listedAt) {
      const allText = Array.from(document.querySelectorAll("span, p"));
      const timeAgoRegex = /(\d+)\s+(day|days|week|weeks|month|months|hour|hours)\s+ago/i;
      const timeMatch = allText.find((el) => timeAgoRegex.test(el.innerText || ""));
      
      if (timeMatch) {
        const match = timeMatch.innerText.match(timeAgoRegex);
        if (match) {
          const amount = parseInt(match[1], 10);
          const unit = match[2].toLowerCase();
          
          // Calculate the date based on "X days/weeks/months ago"
          const now = new Date();
          if (unit.startsWith("hour")) {
            now.setHours(now.getHours() - amount);
          } else if (unit.startsWith("day")) {
            now.setDate(now.getDate() - amount);
          } else if (unit.startsWith("week")) {
            now.setDate(now.getDate() - (amount * 7));
          } else if (unit.startsWith("month")) {
            now.setMonth(now.getMonth() - amount);
          }
          
          listedAt = now.toISOString();
        }
      }
    }
    
    // Description extraction
    if (!description) {
      const descElement = document.querySelector("[data-testid='expandable-text-box']") ||
                         document.querySelector("#job-details") ||
                         document.querySelector("main");
      
      if (descElement) {
        // Get innerHTML and convert <br> tags to double newlines (paragraph breaks)
        let html = descElement.innerHTML;
        html = html.replace(/<br\s*\/?>/gi, "\n\n");
        // Remove all other HTML tags
        html = html.replace(/<[^>]+>/g, " ");
        // Decode HTML entities
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;
        description = tempDiv.textContent || tempDiv.innerText || "";
        
        // Clean up whitespace while preserving paragraph breaks
        description = description
          .replace(/[ \t]+/g, " ")          // Multiple spaces/tabs become single space
          .replace(/ ?\n\n ?/g, "\n\n")     // Clean spaces around paragraph breaks
          .replace(/\n{3,}/g, "\n\n")       // 3+ newlines become 2
          .trim();
      } else {
        description = "";
      }
    }
    
    // Remove LinkedIn-specific header text
    description = description.replace(/^Job Details\s+Description\s+/i, "");
    
    // Parse role summary and company overview
    // Strategy: Look for "About Us" and "Position Summary" section headers
    // Extract each section separately, preserving paragraph breaks
    
    const aboutUsIndex = description.search(/\bAbout Us\b/i);
    const positionSummaryIndex = description.search(/\bPosition Summary\b/i);
    const dutiesIndex = description.search(/\bEssential Duties\b/i);
    
    // Track where About Us section ends (needed for fallback logic)
    let aboutUsEnd = description.length;
    
    // Extract Company Overview (About Us section)
    if (aboutUsIndex !== -1) {
      // Find end of About Us section (usually Position Summary comes next)
      if (positionSummaryIndex !== -1 && positionSummaryIndex > aboutUsIndex) {
        aboutUsEnd = positionSummaryIndex;
      } else if (dutiesIndex !== -1 && dutiesIndex > aboutUsIndex) {
        aboutUsEnd = dutiesIndex;
      }
      
      // Extract and clean - preserve newlines
      companyOverview = description
        .slice(aboutUsIndex, aboutUsEnd)
        .replace(/^About Us\s*/i, "")
        .trim();
      
      // Limit length while keeping complete paragraphs
      if (companyOverview.length > 1000) {
        companyOverview = companyOverview.slice(0, 1000).trim();
      }
    }
    
    // Extract Role Summary (Position Summary section)
    if (positionSummaryIndex !== -1) {
      // Find end of Position Summary section (usually Essential Duties comes next)
      let positionSummaryEnd = description.length;
      if (dutiesIndex !== -1 && dutiesIndex > positionSummaryIndex) {
        positionSummaryEnd = dutiesIndex;
      }
      
      // Extract and clean - preserve newlines
      roleSummary = description
        .slice(positionSummaryIndex, positionSummaryEnd)
        .replace(/^Position Summary\s*/i, "")
        .trim();
    } else if (dutiesIndex !== -1) {
      // No explicit Position Summary, take everything before Essential Duties
      let beforeDuties = description.slice(0, dutiesIndex).trim();
      
      // If we already extracted company overview, remove it from role summary
      if (aboutUsIndex !== -1) {
        // Remove the About Us section from the role summary
        beforeDuties = beforeDuties.slice(0, aboutUsIndex).trim();
      }
      
      roleSummary = beforeDuties;
    } else {
      // Fallback: take first portion of description
      let fallbackSummary = description.slice(0, 1500).trim();
      
      // Remove About Us section if present
      if (aboutUsIndex !== -1 && aboutUsIndex < 1500) {
        const beforeAboutUs = description.slice(0, aboutUsIndex).trim();
        const afterAboutUs = description.slice(aboutUsEnd).slice(0, 1500 - aboutUsIndex).trim();
        roleSummary = (beforeAboutUs + "\n\n" + afterAboutUs).trim();
      } else {
        roleSummary = fallbackSummary;
      }
    }
    
    // LinkedIn-specific structured benefits
    benefits = extractLinkedInStructuredBenefits();
    
    // Work setting
    const fullContent = (title + " " + location + " " + description);
    workSetting = parseWorkSetting(fullContent);
    
    // Salary
    const salaryData = extractSalaryRange(description);
    salaryMin = salaryData.salaryMin;
    salaryMax = salaryData.salaryMax;
    
    return {
      title,
      company,
      location,
      description,
      salaryMin,
      salaryMax,
      workSetting,
      roleSummary,
      companyOverview,
      benefits,
      listedAt
    };
  }
  
  /**
   * Indeed-specific scraper
   * TODO: Implement Indeed-specific selectors and logic
   */
  function scrapeIndeed() {
    // Placeholder for Indeed-specific scraping
    // Will use generic scraper for now
    return null;
  }
  
  /**
   * ZipRecruiter-specific scraper
   * TODO: Implement ZipRecruiter-specific selectors and logic
   */
  function scrapeZipRecruiter() {
    // Placeholder for ZipRecruiter-specific scraping
    // Will use generic scraper for now
    return null;
  }
  
  /**
   * Generic scraper - works for any job board
   * Uses JSON-LD, meta tags, and common selectors
   */
  function scrapeGeneric() {
    let title = "";
    let company = "";
    let location = "";
    let description = "";
    let salaryMin = null;
    let salaryMax = null;
    let workSetting = "REMOTE";
    
    // JSON-LD structured data
    const jsonLdScripts = Array.from(document.querySelectorAll("script[type='application/ld+json']"));
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.innerText);
        if (data["@type"] === "JobPosting" || data.title) {
          title = data.title || title;
          if (data.hiringOrganization) {
            company = typeof data.hiringOrganization === "string"
              ? data.hiringOrganization
              : data.hiringOrganization.name || company;
          }
          if (data.jobLocation) {
            const locObj = Array.isArray(data.jobLocation) ? data.jobLocation[0] : data.jobLocation;
            if (locObj?.address) {
              location = [locObj.address.addressLocality, locObj.address.addressRegion]
                .filter(Boolean)
                .join(", ");
            }
          }
          description = data.description || description;
        }
      } catch (e) {}
    }
    
    // Document title fallback
    if (!title) {
      const docTitle = document.title || "";
      if (docTitle && docTitle.includes("|")) {
        const parts = docTitle.split("|").map((p) => p.trim());
        if (parts[0]) title = parts[0];
      } else {
        title = document.querySelector("h1")?.innerText || "";
      }
    }
    
    // Company fallback
    if (!company) {
      company = document.querySelector("[itemprop='hiringOrganization']")?.innerText ||
                document.querySelector("h2")?.innerText || "";
    }
    
    // Location fallback
    if (!location) {
      const spans = Array.from(document.querySelectorAll("span, p"));
      const cityStateRegex = /([A-Z][a-zA-Z\s]+,\s*[A-Z]{2})/;
      const locMatch = spans.find((s) => cityStateRegex.test(s.innerText || ""));
      if (locMatch) {
        const match = locMatch.innerText.match(cityStateRegex);
        if (match) location = match[1].trim();
      }
    }
    
    // Description fallback
    if (!description) {
      description =
        document.querySelector("[itemprop='description']")?.innerText ||
        document.querySelector("#job-details")?.innerText ||
        document.querySelector("main")?.innerText ||
        "";
    }
    
    // Clean description
    description = description.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();
    
    // Work setting
    const fullContent = (title + " " + location + " " + description);
    workSetting = parseWorkSetting(fullContent);
    
    // Salary
    const salaryData = extractSalaryRange(description);
    salaryMin = salaryData.salaryMin;
    salaryMax = salaryData.salaryMax;
    
    // Role summary and company overview (simple split)
    const midpoint = Math.min(Math.floor(description.length / 2), 800);
    const roleSummary = description.slice(0, midpoint).trim();
    const companyOverview = description.slice(midpoint).trim().slice(0, 800);
    
    return {
      title,
      company,
      location,
      description,
      salaryMin,
      salaryMax,
      workSetting,
      roleSummary,
      companyOverview,
      benefits: [] // Will be extracted generically later
    };
  }
  
  // ============================================
  // MAIN SCRAPING ORCHESTRATION
  // ============================================
  
  // Route to appropriate scraper based on job board
  let scrapedData;
  
  switch (source) {
    case "LinkedIn":
      scrapedData = scrapeLinkedIn();
      break;
    case "Indeed":
      scrapedData = scrapeIndeed() || scrapeGeneric();
      break;
    case "ZipRecruiter":
      scrapedData = scrapeZipRecruiter() || scrapeGeneric();
      break;
    default:
      scrapedData = scrapeGeneric();
  }
  
  // Extract tech stack (works for all job boards)
  const detectedStack = extractTechStack(scrapedData.description);
  
  // Extract benefits (works for all job boards)
  const benefitsFromDescription = extractBenefitsFromDescription(scrapedData.description);
  
  // Combine board-specific benefits with generic benefits
  const allBenefits = [...scrapedData.benefits, ...benefitsFromDescription];
  let benefits = [...new Set(allBenefits)].slice(0, 15); // Deduplicate and limit
  
  // Remove redundant Remote Work benefit if work setting is already REMOTE
  if (scrapedData.workSetting === "REMOTE") {
    benefits = benefits.filter(b => !/^(remote\s*work|work\s*from\s*home)$/i.test(b));
  }
  
  // Return final data
  return {
    title: (scrapedData.title || "").split("\n")[0].trim(),
    company: (scrapedData.company || "").split("\n")[0].trim(),
    location: (scrapedData.location || "").split("\n")[0].trim(),
    workSetting: scrapedData.workSetting,
    salaryMin: scrapedData.salaryMin,
    salaryMax: scrapedData.salaryMax,
    techStack: detectedStack,
    roleSummary: scrapedData.roleSummary || (scrapedData.description ? scrapedData.description.slice(0, 500) : ""),
    companyOverview: scrapedData.companyOverview || (scrapedData.description ? scrapedData.description.slice(500, 800) : ""),
    benefits: benefits,
    listedAt: scrapedData.listedAt || null,
    originalUrls: [window.location.href],
    sources: [source],
  };
}