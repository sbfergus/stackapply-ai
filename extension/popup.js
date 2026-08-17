document.addEventListener("DOMContentLoaded", async () => {
  const saveBtn = document.getElementById("save-btn");
  const statusEl = document.getElementById("status");

  let scrapedData = {};

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab?.id) {
      // Direct injection into active tab DOM
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
    if (data.techStack && Array.isArray(data.techStack)) {
      document.getElementById("techStack").value = data.techStack.join(", ");
    }
  }

  // Handle Save Button Click
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    const title = document.getElementById("title").value.trim();
    const company = document.getElementById("company").value.trim();
    const location = document.getElementById("location").value.trim();
    const selectedWorkSetting = document.getElementById("workSetting").value; // IN_OFFICE, HYBRID, REMOTE
    const salaryMin = parseInt(document.getElementById("salaryMin").value, 10) || null;
    const salaryMax = parseInt(document.getElementById("salaryMax").value, 10) || null;
    const roleSummary = document.getElementById("roleSummary").value.trim();
    const techStackInput = document.getElementById("techStack").value;

    const techStack = techStackInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Spread scrapedData FIRST, then explicitly override with user form selections SECOND
    const payload = {
      ...scrapedData,
      title,
      company,
      location,
      workSetting: selectedWorkSetting, // Hard overrides with selected dropdown option
      setting: selectedWorkSetting,
      workType: selectedWorkSetting,
      salaryMin,
      salaryMax,
      roleSummary,
      techStack,
      // Keep the detected source from scraping, don't override
    };

    // Production Vercel API endpoint
    const API_URL = "https://stackapply-ai.vercel.app/api/jobs";
    
    // For local testing, use: http://localhost:3000/api/jobs

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      console.log("API Response:", res.status, data);

      if (res.ok && data.success) {
        statusEl.innerText = "✅ Saved to Dashboard!";
        statusEl.className = "status success";
        setTimeout(() => window.close(), 1200);
      } else if (res.status === 409) {
        // Duplicate detected
        statusEl.innerText = "⚠️ Unable to Save, Duplicate Listing";
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
});

// Self-contained scraper function injected directly into active tab
function scrapeJobDataInTab() {
  const url = window.location.href;
  let title = "";
  let company = "";
  let location = "";
  let description = "";
  let salaryMin = null;
  let salaryMax = null;
  let workSetting = "REMOTE";

  // Detect job board source from URL
  let source = "Web";
  if (url.includes("linkedin.com")) {
    source = "LinkedIn";
  } else if (url.includes("indeed.com")) {
    source = "Indeed";
  } else if (url.includes("glassdoor.com")) {
    source = "Glassdoor";
  } else if (url.includes("ziprecruiter.com")) {
    source = "ZipRecruiter";
  } else if (url.includes("monster.com")) {
    source = "Monster";
  } else if (url.includes("dice.com")) {
    source = "Dice";
  } else if (url.includes("wellfound.com") || url.includes("angel.co")) {
    source = "Wellfound";
  } else if (url.includes("lever.co")) {
    source = "Lever";
  } else if (url.includes("greenhouse.io")) {
    source = "Greenhouse";
  }

  // 1. JSON-LD Structured Data Schema Parsing
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

  // 2. Document Title / Open Graph Fallback
  if (!title || !company) {
    const docTitle = document.title || "";
    if (docTitle && docTitle.includes("|") && !docTitle.toLowerCase().includes("feed")) {
      const parts = docTitle.split("|").map((p) => p.trim());
      if (!title && parts[0]) title = parts[0];
      if (!company && parts[1] && !parts[1].toLowerCase().includes("linkedin")) company = parts[1];
    }
  }

  // 3. DOM Fallbacks
  if (!title) {
    title = document.querySelector("h1")?.innerText || "";
  }

  if (!company) {
    const companyAnchor = document.querySelector("a[href*='/company/']");
    if (companyAnchor) company = companyAnchor.innerText;
  }

  // 4. Location Extraction
  if (!location) {
    const spans = Array.from(document.querySelectorAll("span, p"));
    const cityStateRegex = /([A-Z][a-zA-Z\s]+,\s*[A-Z]{2})/;
    const locMatch = spans.find((s) => cityStateRegex.test(s.innerText || ""));

    if (locMatch) {
      const match = locMatch.innerText.match(cityStateRegex);
      if (match) location = match[1].trim();
    }
  }

  if (!description) {
    description =
      document.querySelector("[data-testid='expandable-text-box']")?.innerText ||
      document.querySelector("#job-details")?.innerText ||
      document.querySelector("main")?.innerText ||
      "";
  }

  // Clean raw description
  description = description.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();

  // Strict Work Setting Parsing (Strictly IN_OFFICE, HYBRID, REMOTE)
  const fullContent = (title + " " + location + " " + description).toUpperCase();
  if (fullContent.includes("HYBRID")) {
    workSetting = "HYBRID";
  } else if (
    fullContent.includes("ON-SITE") ||
    fullContent.includes("ONSITE") ||
    fullContent.includes("IN-OFFICE") ||
    fullContent.includes("IN OFFICE")
  ) {
    workSetting = "IN_OFFICE";
  } else {
    workSetting = "REMOTE";
  }

  // Salary Range Extraction
  const salaryRegex = /\$(\d{2,3})[,\.]?(\d{3})?\s*(?:-|to)\s*\$(\d{2,3})[,\.]?(\d{3})?/i;
  const salaryMatch = description.match(salaryRegex);
  if (salaryMatch) {
    let rawMin = parseInt(salaryMatch[1].replace(/,/g, ""), 10);
    let rawMax = parseInt(salaryMatch[3].replace(/,/g, ""), 10);
    if (rawMin < 1000) rawMin *= 1000;
    if (rawMax < 1000) rawMax *= 1000;
    salaryMin = rawMin;
    salaryMax = rawMax;
  }

  // Strict Tech Stack Rules
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

  const detectedStack = techRules
    .filter((rule) => rule.regex.test(description))
    .map((rule) => rule.name);

  return {
    title: (title || "").split("\n")[0].trim(),
    company: (company || "").split("\n")[0].trim(),
    location: (location || "").split("\n")[0].trim(),
    workSetting,
    salaryMin,
    salaryMax,
    techStack: detectedStack,
    roleSummary: description ? description.slice(0, 400) + "..." : "",
    companyOverview: description ? description.slice(0, 250) + "..." : "",
    originalUrls: [window.location.href],
    sources: [source],
  };
}