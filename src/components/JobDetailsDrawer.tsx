"use client";

import { useEffect, useState } from "react";
import {
  X,
  ExternalLink,
  Sparkles,
  Building2,
  MapPin,
  Banknote,
  Calendar,
  Globe,
  Trash2,
  Save,
  Check,
  FileText,
} from "lucide-react";
import { Job } from "@/app/dashboard/page";

interface JobDetailsDrawerProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onJobUpdated: (updatedJob: Job) => void;
  onJobDeleted: (jobId: string) => void;
}

const STAGE_OPTIONS = [
  { id: "TO_REVIEW", label: "To Review" },
  { id: "READY_TO_APPLY", label: "Ready to Apply" },
  { id: "APPLIED", label: "Applied" },
  { id: "INTERVIEWING", label: "Interviewing" },
];

// Helper function to format salary
const formatSalary = (amount: number): string => {
  if (amount >= 1000000) {
    // For millions, show up to 2 decimal places, remove trailing zeros
    const millions = amount / 1000000;
    return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(2).replace(/\.?0+$/, '')}M`;
  } else {
    // For thousands
    return `$${(amount / 1000).toFixed(0)}k`;
  }
};

export function JobDetailsDrawer({
  job,
  isOpen,
  onClose,
  onJobUpdated,
  onJobDeleted,
}: JobDetailsDrawerProps) {
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (job) {
      setNotes(job.notes || "");
    }
  }, [job]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !job) return null;

  const handleStatusChange = async (newStatus: Job["status"]) => {
    const updated = { ...job, status: newStatus };
    onJobUpdated(updated);

    try {
      await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error("Failed to update status from drawer:", err);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      if (res.ok) {
        onJobUpdated({ ...job, notes });
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save notes:", err);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this job listing?")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onJobDeleted(job.id);
        onClose();
      }
    } catch (err) {
      console.error("Failed to delete job:", err);
    } finally {
      setDeleting(false);
    }
  };

  const originalUrl = job.originalUrls?.[0];

  return (
  <div className="fixed inset-0 z-50 flex justify-end">
    {/* Subtle Backdrop Tint & Blur */}
    <div
      className="fixed inset-0 bg-slate-950/25 backdrop-blur-[2px] transition-opacity"
      onClick={onClose}
    />

    {/* Right Drawer Panel */}
    <div className="relative z-10 w-full max-w-2xl bg-slate-900 border-l border-slate-800/90 h-full shadow-2xl flex flex-col transition-all duration-200">
      {/* Drawer Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-900/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <select
            value={job.status}
            onChange={(e) => handleStatusChange(e.target.value as Job["status"])}
            className="bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg text-xs px-2.5 py-1.5 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {STAGE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          {originalUrl && (
            <a
              href={originalUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium bg-indigo-950/50 border border-indigo-800/40 px-2.5 py-1.5 rounded-lg transition"
            >
              <span>Original Post</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete Job"
            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Title & Company */}
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 font-medium mb-1">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span>{job.company}</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {job.title}
          </h2>
        </div>

        {/* Match Score & Reasoning Banner */}
        {job.matchScore && (
          <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/40 border border-emerald-800/40 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>AI Match Analysis</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                {job.matchScore}% Match
              </span>
            </div>
            {job.matchReasoning && (
              <p className="text-xs text-slate-300 leading-relaxed">
                {job.matchReasoning}
              </p>
            )}
          </div>
        )}

        {/* Key Facts Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/50 p-3.5 rounded-xl border border-slate-800/60">
          {job.location && (
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="truncate">{job.location} {job.workSetting && `(${job.workSetting})`}</span>
            </div>
          )}

          {(job.salaryMin || job.salaryMax) && (
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <Banknote className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                {formatSalary(job.salaryMin!)} - {formatSalary(job.salaryMax!)} / year
              </span>
            </div>
          )}

          {job.sources && job.sources.length > 0 && (
            <div className="flex items-center gap-2 text-slate-400">
              <Globe className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Source: {job.sources.join(", ")}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              Job Listed: {job.listedAt ? new Date(job.listedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              Date Added: {job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              Date Applied: {job.appliedAt ? new Date(job.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
            </span>
          </div>
        </div>

        {/* Full Tech Stack */}
        {job.techStack.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Required Tech Stack ({job.techStack.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {job.techStack.map((tech) => (
                <span
                  key={tech}
                  className="text-xs bg-slate-800 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono"
                >
                  {tech.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Role Summary */}
        {job.roleSummary && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Role Summary
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/30 p-3.5 rounded-xl border border-slate-800/40 whitespace-pre-wrap">
              {job.roleSummary}
            </p>
          </div>
        )}

        {/* Company Overview */}
        {job.companyOverview && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Company Overview
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/30 p-3.5 rounded-xl border border-slate-800/40 whitespace-pre-wrap">
              {job.companyOverview}
            </p>
          </div>
        )}

        {/* Perks & Benefits */}
        {job.benefits && job.benefits.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Perks & Benefits
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {job.benefits.map((benefit, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/40 px-3 py-2 rounded-lg border border-slate-800/60"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes Textarea */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Personal Notes</span>
            </label>

            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Saved</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingNotes ? "Saving..." : "Save Notes"}</span>
                </>
              )}
            </button>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Jot down recruiter call details, interview questions, or follow-up tasks..."
            className="w-full h-28 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none font-sans"
          />
        </div>
      </div>
    </div>
  </div>
);
}