// ============================================
// API CONFIGURATION
// ============================================
// Automatically use production URL
// To test locally, manually change to: http://localhost:3000
const API_BASE_URL = "https://stackapply-ai.vercel.app";

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
    const response = await fetch(`${API_BASE_URL}/api/auth/extension/validate`, {
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

  // Token exists - validate it with the API before showing authenticated UI
  const isValid = await validateToken(authState.token);
  
  if (!isValid) {
    // Token is invalid/expired - clear and redirect to auth
    await clearAuthState();
    window.location.href = 'popup-auth.html';
    return;
  }

  // Token is valid - proceed to authenticated popup
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
  const linkedinStatusEl = document.getElementById("linkedin-status");
  const linkedinStatusIcon = document.getElementById("linkedin-status-icon");
  const linkedinStatusText = document.getElementById("linkedin-status-text");
  const linkedinSyncBtn = document.getElementById("linkedin-sync-btn");
  const settingsBtn = document.getElementById("settings-btn");
  const settingsMenu = document.getElementById("settings-menu");
  const signoutBtn = document.getElementById("signout-btn");
  const switchAccountBtn = document.getElementById("switch-account-btn");
  const rescrapeBtn = document.getElementById("refresh-btn");
  const useAIToggle = document.getElementById("use-ai-toggle");
  const usageCounterEl = document.getElementById("usage-counter");

  // Show user header
  userHeaderEl.style.display = 'flex';

  // Display user info in header
  if (authState.isGuest) {
    userEmailEl.textContent = "Guest User";
    guestBadgeEl.style.display = 'inline-block';
    linkedinStatusEl.style.display = 'none'; // Hide for guests
    linkedinSyncBtn.style.display = 'none'; // Hide for guests
  } else {
    userEmailEl.textContent = authState.user.email;
    guestBadgeEl.style.display = 'none';
    linkedinStatusEl.style.display = 'flex';
    linkedinSyncBtn.style.display = 'flex';
    
    // Fetch and display LinkedIn sync status
    await updateLinkedInStatus(authState.token);
  }

  // LinkedIn Sync Button Handler
  linkedinSyncBtn.addEventListener("click", async () => {
    await handleLinkedInSync(authState.token);
  });

  // Fetch API key data and configure toggle
  let apiKeyData = null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/usage/extension`, {
      headers: {
        'Authorization': `Bearer ${authState.token}`
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        apiKeyData = data.data;
        
        // Set toggle state based on available analyses or custom key
        const hasAnalysesAvailable = apiKeyData.hasKey || apiKeyData.freeAnalysesRemaining > 0;
        useAIToggle.checked = hasAnalysesAvailable;
        useAIToggle.disabled = !hasAnalysesAvailable;
        
        // Update slider styling
        const slider = useAIToggle.nextElementSibling;
        if (!hasAnalysesAvailable) {
          slider.classList.add('disabled');
        } else {
          slider.classList.remove('disabled');
        }
        
        // Update usage counter text - visible to the right of toggle
        if (apiKeyData.hasKey) {
          usageCounterEl.textContent = 'Your key';
        } else {
          usageCounterEl.textContent = `${apiKeyData.freeAnalysesRemaining}/${apiKeyData.freeTierLimit} free`;
        }
      } else {
        usageCounterEl.textContent = 'Error';
      }
    } else {
      usageCounterEl.textContent = 'Error';
    }
  } catch (err) {
    console.error('Error fetching API key data:', err);
    useAIToggle.disabled = true;
    usageCounterEl.textContent = 'Error';
  }

  // Toggle click handler
  useAIToggle.addEventListener('change', () => {
    // Just toggle the state - actual enforcement happens on the server
    console.log('Use AI toggled:', useAIToggle.checked);
  });

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

  // Function to scrape and populate form
  async function scrapeAndPopulate() {
    rescrapeBtn.disabled = true;
    rescrapeBtn.classList.add('spinning');
    statusEl.innerText = "";
    statusEl.className = "status";
    
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
          statusEl.innerText = "✅ Job data refreshed!";
          statusEl.className = "status success";
          setTimeout(() => {
            statusEl.innerText = "";
            statusEl.className = "status";
          }, 2000);
        } else {
          statusEl.innerText = "⚠️ No job data found on this page";
          statusEl.className = "status error";
        }
      }
    } catch (err) {
      console.error("Refresh error:", err);
      statusEl.innerText = "❌ Failed to refresh job data";
      statusEl.className = "status error";
    } finally {
      rescrapeBtn.disabled = false;
      rescrapeBtn.classList.remove('spinning');
      updateButtonState();
    }
  }

  // Scrape job data from current tab on load
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

  // Rescrape button click handler
  rescrapeBtn.addEventListener("click", scrapeAndPopulate);

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

  // Check if form has any data
  function hasFormData() {
    const title = document.getElementById("title").value.trim();
    const company = document.getElementById("company").value.trim();
    const location = document.getElementById("location").value.trim();
    const salaryMin = document.getElementById("salaryMin").value.trim();
    const salaryMax = document.getElementById("salaryMax").value.trim();
    const techStack = document.getElementById("techStack").value.trim();
    const roleSummary = document.getElementById("roleSummary").value.trim();
    const companyOverview = document.getElementById("companyOverview").value.trim();
    const benefits = document.getElementById("benefits").value.trim();
    
    return !!(title || company || location || salaryMin || salaryMax || 
              techStack || roleSummary || companyOverview || benefits);
  }
  
  // Clear all form fields
  function clearForm() {
    document.getElementById("title").value = "";
    document.getElementById("company").value = "";
    document.getElementById("location").value = "";
    document.getElementById("workSetting").value = "REMOTE";
    document.getElementById("salaryMin").value = "";
    document.getElementById("salaryMax").value = "";
    document.getElementById("techStack").value = "";
    document.getElementById("roleSummary").value = "";
    document.getElementById("companyOverview").value = "";
    document.getElementById("benefits").value = "";
    statusEl.innerText = "";
    statusEl.className = "status";
    scrapedData = {}; // Clear scraped data
  }
  
  // Update button state based on form data
  function updateButtonState() {
    const hasData = hasFormData();
    
    if (saveBtn.innerText === "🔄 Reset") {
      // Reset button is always enabled
      saveBtn.disabled = false;
    } else {
      // Save button disabled if no data
      saveBtn.disabled = !hasData;
    }
  }
  
  // Listen to form changes to enable/disable button
  const formFields = [
    "title", "company", "location", "salaryMin", "salaryMax",
    "techStack", "roleSummary", "companyOverview", "benefits"
  ];
  
  formFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    field.addEventListener("input", updateButtonState);
  });
  
  // Set initial button state
  updateButtonState();

  // Handle Save/Reset Button Click
  saveBtn.addEventListener("click", async () => {
    // If button is in Reset mode, clear form
    if (saveBtn.innerText === "🔄 Reset") {
      clearForm();
      saveBtn.innerText = "Save to Dashboard";
      updateButtonState();
      return;
    }
    
    // Otherwise, save the job
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
        // Token expired or unauthorized - show clickable sign in message
        statusEl.innerHTML = "⚠️ Unauthorized. <span id='signin-link' style='color: #6366f1; text-decoration: underline; cursor: pointer;'>Please sign in</span>.";
        statusEl.className = "status error";
        
        // Add click handler to sign in link
        document.getElementById('signin-link').addEventListener('click', async () => {
          await clearAuthState();
          window.location.href = 'popup-auth.html';
        });
        
        saveBtn.disabled = false;
        saveBtn.innerText = "Save to Dashboard";
        return;
      }

      if (res.ok && data.success) {
        statusEl.innerText = authState.isGuest 
          ? "✅ Saved to Guest Dashboard!" 
          : "✅ Saved to Your Dashboard!";
        statusEl.className = "status success";
        
        // Change button to Reset mode
        saveBtn.innerText = "🔄 Reset";
        saveBtn.disabled = false;
      } else if (res.status === 409) {
        statusEl.innerText = "Already in your dashboard";
        statusEl.className = "status error";
        saveBtn.disabled = false;
        saveBtn.innerText = "Save to Dashboard";
      } else {
        // Log full error for debugging
        console.error('Job save failed:', { status: res.status, data });
        statusEl.innerText = "❌ Error: " + (data.message || data.error || "Failed to save");
        statusEl.className = "status error";
        saveBtn.disabled = false;
        saveBtn.innerText = "Save to Dashboard";
      }
    } catch (err) {
      console.error('Job save exception:', err);
      statusEl.innerText = "❌ Could not connect to StackApply API";
      statusEl.className = "status error";
      saveBtn.disabled = false;
      saveBtn.innerText = "Save to Dashboard";
    }
  });
}

/**
 * Handle sign out
 */
async function handleSignOut(token) {
  try {
    // Call API to revoke token
    await fetch(`${API_BASE_URL}/api/auth/extension/signout`, {
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
    
    // Additional fallback for mobile LinkedIn
    if (!company) {
      // Try various selectors that mobile LinkedIn might use
      const selectors = [
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name",
        "[data-tracking-control-name='public_jobs_topcard-org-name']",
        ".topcard__org-name-link",
        ".jobs-company",
        "a.app-aware-link[href*='/company/']"
      ];
      
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText && el.innerText.trim()) {
          company = el.innerText.trim();
          break;
        }
      }
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


// ============================================
// LINKEDIN PROFILE SYNC
// ============================================

/**
 * Update LinkedIn sync status badge
 */
async function updateLinkedInStatus(token) {
  const linkedinStatusEl = document.getElementById("linkedin-status");
  const linkedinStatusIcon = document.getElementById("linkedin-status-icon");
  const linkedinStatusText = document.getElementById("linkedin-status-text");
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/user/linkedin/sync`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data.hasSynced) {
        // Profile is synced
        linkedinStatusEl.className = 'linkedin-status synced';
        linkedinStatusIcon.textContent = '✓';
        linkedinStatusText.textContent = 'Profile Synced';
      } else {
        // Profile not synced yet
        linkedinStatusEl.className = 'linkedin-status not-synced';
        linkedinStatusIcon.textContent = '⚠️';
        linkedinStatusText.textContent = 'No Profile';
      }
    }
  } catch (err) {
    console.error('Error fetching LinkedIn status:', err);
  }
}

/**
 * Handle LinkedIn profile sync
 */
async function handleLinkedInSync(token) {
  const linkedinSyncBtn = document.getElementById("linkedin-sync-btn");
  const statusEl = document.getElementById("status");
  
  // Disable button and show syncing state
  linkedinSyncBtn.disabled = true;
  linkedinSyncBtn.classList.add('syncing');
  statusEl.innerText = "🔄 Syncing LinkedIn profile...";
  statusEl.className = "status";
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if user is on LinkedIn profile page
    if (!tab?.url || !tab.url.includes('linkedin.com/in/')) {
      statusEl.innerText = "⚠️ Please navigate to your LinkedIn profile page";
      statusEl.className = "status error";
      linkedinSyncBtn.disabled = false;
      linkedinSyncBtn.classList.remove('syncing');
      setTimeout(() => {
        statusEl.innerText = "";
        statusEl.className = "status";
      }, 4000);
      return;
    }
    
    // Scrape LinkedIn profile
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeLinkedInProfile,
    });
    
    if (results && results[0] && results[0].result) {
      const linkedinData = results[0].result;
      
      // Save to backend
      const res = await fetch(`${API_BASE_URL}/api/user/linkedin/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          linkedinData,
          linkedinUrl: tab.url
        }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        statusEl.innerText = "✅ LinkedIn profile synced successfully!";
        statusEl.className = "status success";
        
        // Update status badge
        await updateLinkedInStatus(token);
        
        setTimeout(() => {
          statusEl.innerText = "";
          statusEl.className = "status";
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to sync profile');
      }
    } else {
      statusEl.innerText = "❌ Could not extract LinkedIn profile data";
      statusEl.className = "status error";
      setTimeout(() => {
        statusEl.innerText = "";
        statusEl.className = "status";
      }, 4000);
    }
  } catch (err) {
    console.error('LinkedIn sync error:', err);
    statusEl.innerText = "❌ Failed to sync: " + err.message;
    statusEl.className = "status error";
    setTimeout(() => {
      statusEl.innerText = "";
      statusEl.className = "status";
    }, 4000);
  } finally {
    linkedinSyncBtn.disabled = false;
    linkedinSyncBtn.classList.remove('syncing');
  }
}

/**
 * Scrape LinkedIn profile data
 * This function is injected into the LinkedIn profile page
 * 
 * Strategy: Use structural selectors (IDs, semantic attributes) instead of
 * fragile CSS classes that LinkedIn frequently changes
 */
function scrapeLinkedInProfile() {
  const profileData = {
    name: '',
    headline: '',
    location: '',
    about: '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    profileUrl: window.location.href,
    scrapedAt: new Date().toISOString(),
  };
  
  try {
    console.log('🔍 Starting LinkedIn profile scrape...');
    
    // ===== TOP CARD: Name, Headline, Location =====
    // Look for section with ID containing "Topcard" or main profile section
    const topCard = document.querySelector('section[id*="topcard"]') || 
                    document.querySelector('div[data-view-name*="profile-topcard"]') ||
                    document.querySelector('main section:first-of-type');
    
    if (topCard) {
      // Name - usually first h1 or h2 in topcard
      const nameEl = topCard.querySelector('h1') || topCard.querySelector('h2');
      if (nameEl) {
        profileData.name = nameEl.innerText.trim();
      }
      
      // Headline - typically a paragraph or div after the name
      const headlineEl = topCard.querySelector('h1 + div') || 
                        topCard.querySelector('h2 + div') ||
                        topCard.querySelector('[class*="headline"]');
      if (headlineEl && !headlineEl.querySelector('h1, h2')) {
        profileData.headline = headlineEl.innerText.trim();
      }
      
      // Location - look for text patterns or geo-related content
      const allText = Array.from(topCard.querySelectorAll('span, div'));
      const locationEl = allText.find(el => {
        const text = el.innerText || '';
        // Common location patterns
        return /United States|Remote|,\s*[A-Z]{2}|Metropolitan Area/i.test(text) &&
               !text.includes('@') && // Not email
               text.length < 100; // Not a long paragraph
      });
      if (locationEl) {
        profileData.location = locationEl.innerText.trim();
      }
    }
    
    // ===== ABOUT SECTION =====
    // Use ID or aria-labelledby attributes (more stable than classes)
    const aboutSection = document.querySelector('section[id*="about"]') ||
                        document.querySelector('section[aria-labelledby*="about"]') ||
                        Array.from(document.querySelectorAll('section')).find(s => {
                          const heading = s.querySelector('h2, h3');
                          return heading && /about/i.test(heading.innerText);
                        });
    
    if (aboutSection) {
      // Find the largest text block (usually the description)
      const textBlocks = Array.from(aboutSection.querySelectorAll('span, div'))
        .filter(el => el.innerText && el.innerText.length > 50)
        .sort((a, b) => b.innerText.length - a.innerText.length);
      
      if (textBlocks[0]) {
        profileData.about = textBlocks[0].innerText.trim();
      }
    }
    
    // ===== EXPERIENCE SECTION =====
    const expSection = document.querySelector('section[id*="experience"]') ||
                      document.querySelector('section[aria-labelledby*="experience"]') ||
                      Array.from(document.querySelectorAll('section')).find(s => {
                        const heading = s.querySelector('h2, h3');
                        return heading && /experience/i.test(heading.innerText);
                      });
    
    if (expSection) {
      // Each experience is typically in a list item
      const expItems = expSection.querySelectorAll('ul > li, [role="listitem"]');
      
      expItems.forEach(item => {
        // Title is usually bold or in a heading
        const titleEl = item.querySelector('span[aria-hidden="true"]') ||
                       item.querySelector('div[class*="title"]') ||
                       Array.from(item.querySelectorAll('span, div')).find(el => {
                         const style = window.getComputedStyle(el);
                         return style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;
                       });
        
        // Company - often has a link to /company/
        const companyEl = item.querySelector('a[href*="/company/"]') ||
                         Array.from(item.querySelectorAll('span')).find(s => 
                           s.innerText && s.innerText.length < 100 && 
                           s.innerText.toLowerCase().includes('company')
                         );
        
        // Dates - look for date-like patterns
        const allSpans = Array.from(item.querySelectorAll('span'));
        const datesEl = allSpans.find(s => 
          /\d{4}|present|now|current/i.test(s.innerText) &&
          s.innerText.length < 50
        );
        
        // Description - usually longer text block
        const descEl = Array.from(item.querySelectorAll('span, div'))
          .filter(el => el.innerText && el.innerText.length > 80)
          .sort((a, b) => b.innerText.length - a.innerText.length)[0];
        
        if (titleEl && titleEl.innerText.trim()) {
          profileData.experience.push({
            title: titleEl.innerText.trim(),
            company: companyEl ? companyEl.innerText.trim() : '',
            dates: datesEl ? datesEl.innerText.trim() : '',
            description: descEl ? descEl.innerText.trim() : '',
          });
        }
      });
    }
    
    // ===== EDUCATION SECTION =====
    const eduSection = document.querySelector('section[id*="education"]') ||
                      document.querySelector('section[aria-labelledby*="education"]') ||
                      Array.from(document.querySelectorAll('section')).find(s => {
                        const heading = s.querySelector('h2, h3');
                        return heading && /education/i.test(heading.innerText);
                      });
    
    if (eduSection) {
      const eduItems = eduSection.querySelectorAll('ul > li, [role="listitem"]');
      
      eduItems.forEach(item => {
        // School name - usually bold or a link
        const schoolEl = item.querySelector('a[href*="/school/"]') ||
                        Array.from(item.querySelectorAll('span, div')).find(el => {
                          const style = window.getComputedStyle(el);
                          return style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;
                        });
        
        const allSpans = Array.from(item.querySelectorAll('span'));
        
        // Degree - often second line of text
        const degreeEl = allSpans.find(s => 
          s.innerText && 
          /degree|bachelor|master|phd|certificate/i.test(s.innerText) &&
          s.innerText.length < 100
        );
        
        // Dates
        const datesEl = allSpans.find(s => 
          /\d{4}|present|now/i.test(s.innerText) &&
          s.innerText.length < 50
        );
        
        if (schoolEl && schoolEl.innerText.trim()) {
          profileData.education.push({
            school: schoolEl.innerText.trim(),
            degree: degreeEl ? degreeEl.innerText.trim() : '',
            dates: datesEl ? datesEl.innerText.trim() : '',
          });
        }
      });
    }
    
    // ===== SKILLS SECTION =====
    const skillsSection = document.querySelector('section[id*="skills"]') ||
                         document.querySelector('section[aria-labelledby*="skills"]') ||
                         Array.from(document.querySelectorAll('section')).find(s => {
                           const heading = s.querySelector('h2, h3');
                           return heading && /skills/i.test(heading.innerText);
                         });
    
    if (skillsSection) {
      // Skills are often in list items or spans
      const skillElements = skillsSection.querySelectorAll('ul > li span[aria-hidden="true"]') ||
                           skillsSection.querySelectorAll('[role="listitem"] span');
      
      skillElements.forEach(skill => {
        const skillText = skill.innerText.trim();
        // Filter out duplicates and non-skill text
        if (skillText && 
            skillText.length < 50 && 
            !profileData.skills.includes(skillText) &&
            !/endorsement|show|more|less/i.test(skillText)) {
          profileData.skills.push(skillText);
        }
      });
    }
    
    // ===== CERTIFICATIONS SECTION =====
    const certSection = document.querySelector('section[id*="licenses"]') ||
                       document.querySelector('section[id*="certification"]') ||
                       document.querySelector('section[aria-labelledby*="certification"]') ||
                       Array.from(document.querySelectorAll('section')).find(s => {
                         const heading = s.querySelector('h2, h3');
                         return heading && /certification|license/i.test(heading.innerText);
                       });
    
    if (certSection) {
      const certItems = certSection.querySelectorAll('ul > li, [role="listitem"]');
      
      certItems.forEach(item => {
        const titleEl = Array.from(item.querySelectorAll('span, div')).find(el => {
          const style = window.getComputedStyle(el);
          return (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600) &&
                 el.innerText && el.innerText.length < 150;
        });
        
        const allSpans = Array.from(item.querySelectorAll('span'));
        
        // Issuer - often contains "by" or organization name
        const issuerEl = allSpans.find(s => 
          s.innerText && s.innerText.length < 100 &&
          s !== titleEl
        );
        
        // Date
        const dateEl = allSpans.find(s => 
          /issued|\d{4}|20\d{2}/i.test(s.innerText) &&
          s.innerText.length < 50
        );
        
        if (titleEl && titleEl.innerText.trim()) {
          profileData.certifications.push({
            name: titleEl.innerText.trim(),
            issuer: issuerEl ? issuerEl.innerText.trim() : '',
            date: dateEl ? dateEl.innerText.trim() : '',
          });
        }
      });
    }
    
    console.log('✅ LinkedIn profile scraped:', profileData);
    return profileData;
    
  } catch (error) {
    console.error('❌ LinkedIn profile scraping error:', error);
    return profileData;
  }
}
