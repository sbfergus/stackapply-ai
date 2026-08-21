export interface Job {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  workSetting?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  techStack: string[];
  matchScore?: number | null;
  matchReasoning?: string | null;
  matchCalculatedWithResumeHash?: string | null;
  companyOverview?: string | null;
  roleSummary?: string | null;
  benefits?: string[];
  sources?: string[];
  originalUrls?: string[];
  notes?: string | null;
  listedAt?: string | null;
  appliedAt?: string | null;
  createdAt?: string | null;
  status: "TO_REVIEW" | "READY_TO_APPLY" | "APPLIED" | "INTERVIEWING";
}
