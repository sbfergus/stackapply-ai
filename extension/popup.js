// Default API target URL (supports both local and production)
const API_URL = "http://localhost:3000/api/jobs"; 
// Change to "https://stackapply-ai.vercel.app/api/jobs" when testing production!

document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // 1. Execute scraper inside active tab
  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      files: ["content.js"],
    },
    () => {
      chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_JOB" }, (response) => {
        if (response) {
          if (response.title) document.getElementById("title").value = response.title;
          if (response.company) document.getElementById("company").value = response.company;
          if (response.location) document.getElementById("location").value = response.location;
          if (response.techStack) document.getElementById("techStack").value = response.techStack.join(", ");
          window.scrapedData = response;
        }
      });
    }
  );

  // 2. Handle "Save to Dashboard" click
  document.getElementById("saveBtn").addEventListener("click", async () => {
    const saveBtn = document.getElementById("saveBtn");
    const statusMsg = document.getElementById("statusMsg");

    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    const title = document.getElementById("title").value;
    const company = document.getElementById("company").value;
    const location = document.getElementById("location").value;
    const techStackInput = document.getElementById("techStack").value;
    const techStack = techStackInput.split(",").map((s) => s.trim()).filter(Boolean);

    const payload = {
      title,
      company,
      location,
      workSetting: location.toLowerCase().includes("remote") ? "REMOTE" : "HYBRID",
      techStack,
      sources: ["Chrome Extension"],
      originalUrls: [tab.url],
      roleSummary: window.scrapedData?.roleSummary || "Saved via extension",
      matchScore: Math.floor(Math.random() * 12) + 88, // 88% - 99%
      status: "TO_REVIEW",
    };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        statusMsg.innerText = "✓ Job saved to StackApply!";
        statusMsg.className = "status-msg success";
        setTimeout(() => window.close(), 1500);
      } else {
        throw new Error(data.error || "Failed to save job");
      }
    } catch (err) {
      statusMsg.innerText = "✕ Error saving job: " + err.message;
      statusMsg.className = "status-msg error";
      saveBtn.disabled = false;
      saveBtn.innerText = "Save to Dashboard";
    }
  });
});