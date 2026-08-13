// Universal scraper for LinkedIn, Indeed, and generic job boards
function scrapeJobData() {
  const url = window.location.href;
  let title = "";
  let company = "";
  let location = "";
  let description = "";

  // 1. LinkedIn Scraper Logic
  if (url.includes("linkedin.com")) {
    title =
      document.querySelector(".job-details-jobs-unified-top-card__job-title")?.innerText ||
      document.querySelector(".jobs-unified-top-card__job-title")?.innerText ||
      document.querySelector("h1")?.innerText ||
      "";

    company =
      document.querySelector(".job-details-jobs-unified-top-card__company-name")?.innerText ||
      document.querySelector(".jobs-unified-top-card__company-name")?.innerText ||
      "";

    location =
      document.querySelector(".job-details-jobs-unified-top-card__bullet")?.innerText ||
      document.querySelector(".jobs-unified-top-card__bullet")?.innerText ||
      "";

    description =
      document.querySelector("#job-details")?.innerText ||
      document.querySelector(".jobs-description__content")?.innerText ||
      "";
  }
  // 2. Indeed Scraper Logic
  else if (url.includes("indeed.com")) {
    title = document.querySelector("h1.jobsearch-JobInfoHeader-title")?.innerText || "";
    company = document.querySelector("[data-company-name='true']")?.innerText || "";
    location = document.querySelector("[data-testid='inlineHeader-companyLocation']")?.innerText || "";
    description = document.querySelector("#jobDescriptionText")?.innerText || "";
  }
  // 3. Fallback Scraper Logic
  else {
    title = document.querySelector("h1")?.innerText || document.title || "";
    company = document.querySelector("[class*='company' i], [class*='employer' i]")?.innerText || "";
    location = document.querySelector("[class*='location' i]")?.innerText || "";
    description = document.querySelector("main, article, body")?.innerText?.slice(0, 2000) || "";
  }

  // Clean strings
  title = title.replace(/\n/g, " ").trim();
  company = company.replace(/\n/g, " ").trim();
  location = location.replace(/\n/g, " ").trim();

  // Basic tech stack parser from description
  const commonTech = [
    "React", "Next.js", "TypeScript", "JavaScript", "Node.js", "Python",
    "PostgreSQL", "Tailwind CSS", "GraphQL", "AWS", "Docker", "Prisma",
    "Java", "Go", "Ruby", "Kubernetes"
  ];
  const detectedStack = commonTech.filter((tech) =>
    new RegExp(`\\b${tech}\\b`, "i").test(description)
  );

  return {
    title,
    company,
    location,
    originalUrls: [url],
    techStack: detectedStack,
    roleSummary: description.slice(0, 300) + "...",
  };
}

// Listen for messages from extension popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SCRAPE_JOB") {
    const data = scrapeJobData();
    sendResponse(data);
  }
  return true;
});