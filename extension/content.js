console.log("⚡ StackApply AI: Content script loaded on page:", window.location.href);

function scrapeJobData() {
  console.log("⚡ StackApply AI: Starting job scrape...");
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

  // --- TIER 1: Try JSON-LD Schema (LinkedIn embeds structured job data) ---
  const jsonLdScripts = Array.from(document.querySelectorAll("script[type='application/ld+json']"));
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.innerText);
      if (data["@type"] === "JobPosting" || data.title) {
        console.log("⚡ StackApply AI: Found JSON-LD JobPosting schema!");
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
    } catch (e) {
      // Ignore non-job JSON-LD scripts
    }
  }

  // --- TIER 2: Page Title Parsing (<title>Job Title | Company | LinkedIn</title>) ---
  if (!title || !company) {
    const docTitle = document.title || "";
    console.log("⚡ StackApply AI: Document title is:", docTitle);
    if (docTitle && docTitle.includes("|") && !docTitle.toLowerCase().includes("feed")) {
      const parts = docTitle.split("|").map((p) => p.trim());
      if (!title && parts[0]) title = parts[0];
      if (!company && parts[1] && !parts[1].toLowerCase().includes("linkedin")) company = parts[1];
    }
  }

  // --- TIER 3: DOM Fallbacks ---
  if (!title) {
    title = document.querySelector("h1")?.innerText || "";
  }

  if (!company) {
    const companyAnchor = document.querySelector("a[href*='/company/']");
    if (companyAnchor) company = companyAnchor.innerText;
  }

  if (!location) {
    const spans = Array.from(document.querySelectorAll("span, p"));
    const locSpan = spans.find((s) => {
      const text = s.innerText || "";
      return (
        text.includes("•") &&
        !text.toLowerCase().includes("beta") &&
        !text.toLowerCase().includes("helpful") &&
        !text.toLowerCase().includes("clicked apply")
      );
    });

    if (locSpan) {
      const parts = locSpan.innerText.split("•").map((p) => p.trim());
      location = parts[1] || parts[0] || "";
    }
  }

  if (!description) {
    description =
      document.querySelector("[data-testid='expandable-text-box']")?.innerText ||
      document.querySelector("#job-details")?.innerText ||
      document.querySelector("main")?.innerText ||
      "";
  }

  // Clean description HTML
  description = description.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();

  // Extract Work Setting
  const fullContent = (title + " " + location + " " + description).toUpperCase();
  if (fullContent.includes("HYBRID")) {
    workSetting = "HYBRID";
  } else if (fullContent.includes("ON-SITE") || fullContent.includes("ONSITE") || fullContent.includes("IN OFFICE")) {
    workSetting = "IN_OFFICE";
  } else {
    workSetting = "REMOTE";
  }

  // Extract Salary
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

  // Extract Tech Stack
  const commonTech = [
    "React", "Next.js", "TypeScript", "JavaScript", "Node.js", "Python",
    "PostgreSQL", "Tailwind CSS", "GraphQL", "AWS", "Docker", "Prisma",
    "Java", "Go", "Ruby", "Kubernetes", "AEM", "Target", "HTML", "CSS",
    "Svelte", "Vue", "SQL", "CDK", "Terraform"
  ];

  const detectedStack = commonTech.filter((tech) =>
    new RegExp(`\\b${tech}\\b`, "i").test(description)
  );

  const scrapedResult = {
    title: title.split("\n")[0].trim(),
    company: company.split("\n")[0].trim(),
    location: location.split("\n")[0].trim(),
    workSetting,
    salaryMin,
    salaryMax,
    techStack: detectedStack,
    roleSummary: description ? description.slice(0, 400) + "..." : "",
    companyOverview: description ? description.slice(0, 250) + "..." : "",
    originalUrls: [url],
    sources: [source],
  };

  console.log("⚡ StackApply AI: Scraped result successfully:", scrapedResult);
  return scrapedResult;
}

// Extension message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("⚡ StackApply AI: Received message from popup:", request);
  if (request.action === "SCRAPE_JOB") {
    const data = scrapeJobData();
    sendResponse(data);
  }
  return true;
});