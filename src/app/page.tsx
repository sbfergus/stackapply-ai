"use client";

import { useEffect, useState } from "react";
import { Briefcase, Building2, MapPin, DollarSign, Sparkles, CheckCircle, Clock } from "lucide-react";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  workSetting: "REMOTE" | "HYBRID" | "IN_OFFICE";
  salaryMin?: number;
  salaryMax?: number;
  techStack: string[];
  matchScore?: number;
  status: "TO_REVIEW" | "READY" | "APPLIED" | "INTERVIEWING" | "ARCHIVED";
  createdAt: string;
}

const STAGES = [
  { id: "TO_REVIEW", label: "To Review", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { id: "READY", label: "Ready to Apply", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { id: "APPLIED", label: "Applied", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { id: "INTERVIEWING", label: "Interviewing", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
];

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const res = await fetch("/api/jobs");
        const data = await res.json();
        if (data.success) {
          setJobs(data.jobs);
        }
      } catch (err) {
        console.error("Failed to load jobs:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return "Not specified";
    const fmt = (n: number) => `$${(n / 1000).toFixed(0)}k`;
    if (min && max) return `${fmt(min)} - ${fmt(max)}`;
    return fmt(min || max || 0);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex items-center justify-between pb-8 mb-8 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-indigo-500" />
            StackApply AI
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Automated job tracking, candidate matching, and AI resume tailoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Claude 3.5 Active
          </span>
        </div>
      </header>

      {/* Main Kanban Board */}
      <section className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
        {STAGES.map((stage) => {
          const stageJobs = jobs.filter((j) => j.status === stage.id);

          return (
            <div key={stage.id} className="bg-slate-900/50 rounded-xl border border-slate-800/80 p-4 flex flex-col">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${stage.color}`}>
                  {stage.label}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {stageJobs.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-slate-600 text-xs animate-pulse">Loading jobs...</div>
                ) : stageJobs.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-800 rounded-lg text-slate-600 text-xs">
                    No jobs in this stage
                  </div>
                ) : (
                  stageJobs.map((job) => (
                    <div
                      key={job.id}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all rounded-lg p-4 shadow-sm group cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-sm text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {job.title}
                        </h3>
                        {job.matchScore !== undefined && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                            {job.matchScore}% Match
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate">{job.company}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate">{job.location} ({job.workSetting})</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-3 bg-slate-950/60 p-2 rounded border border-slate-800/50">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                        {formatSalary(job.salaryMin, job.salaryMax)}
                      </div>

                      {/* Tech Stack Tags */}
                      {job.techStack?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {job.techStack.slice(0, 3).map((tech) => (
                            <span key={tech} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {tech}
                            </span>
                          ))}
                          {job.techStack.length > 3 && (
                            <span className="text-[10px] text-slate-500">
                              +{job.techStack.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}