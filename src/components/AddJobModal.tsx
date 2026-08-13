"use client";

import { useEffect, useState } from "react";
import { X, Plus, Sparkles, Building2, Briefcase, MapPin, DollarSign, Wrench } from "lucide-react";
import { Job } from "@/app/page";

interface AddJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobAdded: (newJob: Job) => void;
}

export function AddJobModal({ isOpen, onClose, onJobAdded }: AddJobModalProps) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("Remote");
  const [workSetting, setWorkSetting] = useState("REMOTE");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [techStackInput, setTechStackInput] = useState("");
  const [roleSummary, setRoleSummary] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!title.trim() || !company.trim()) {
      setErrorMsg("Job title and company name are required.");
      return;
    }

    setSubmitting(true);

    const techStack = techStackInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      company: company.trim(),
      location: location.trim() || "Remote",
      workSetting,
      salaryMin: salaryMin ? Number(salaryMin) : null,
      salaryMax: salaryMax ? Number(salaryMax) : null,
      techStack,
      roleSummary: roleSummary.trim() || null,
      originalUrls: originalUrl.trim() ? [originalUrl.trim()] : [],
      sources: ["Manual Entry"],
      status: "TO_REVIEW",
      matchScore: Math.floor(Math.random() * 10) + 88, // Default demo match score 88-97%
    };

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onJobAdded(data.job);
        // Reset form
        setTitle("");
        setCompany("");
        setLocation("Remote");
        setSalaryMin("");
        setSalaryMax("");
        setTechStackInput("");
        setRoleSummary("");
        setOriginalUrl("");
        onClose();
      } else {
        setErrorMsg(data.error || "Failed to create job.");
      }
    } catch (err) {
      console.error("Error creating job:", err);
      setErrorMsg("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Add New Job</h2>
              <p className="text-xs text-slate-400">Track a new opportunity on your board</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/50 rounded-xl text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Title & Company Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-slate-500" />
                Job Title <span className="text-indigo-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Senior React Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-500" />
                Company <span className="text-indigo-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Stripe"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          {/* Location & Work Setting */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-500" />
                Location
              </label>
              <input
                type="text"
                placeholder="e.g. Denver, CO"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Work Setting
              </label>
              <select
                value={workSetting}
                onChange={(e) => setWorkSetting(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
                <option value="ONSITE">On-Site</option>
               </select>
            </div>
          </div>

          {/* Salary Min / Max */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-slate-500" />
                Salary Min ($)
              </label>
              <input
                type="number"
                step="5000"
                placeholder="140000"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-slate-500" />
                Salary Max ($)
              </label>
              <input
                type="number"
                step="5000"
                placeholder="180000"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          {/* Tech Stack */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Wrench className="w-3 h-3 text-slate-500" />
              Required Tech Stack (Comma Separated)
            </label>
            <input
              type="text"
              placeholder="Next.js, TypeScript, Tailwind CSS, Prisma"
              value={techStackInput}
              onChange={(e) => setTechStackInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
            />
          </div>

          {/* Job Post URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Job Post URL
            </label>
            <input
              type="url"
              placeholder="https://linkedin.com/jobs/view/..."
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          {/* Role Summary */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Role Summary / Key Details
            </label>
            <textarea
              value={roleSummary}
              onChange={(e) => setRoleSummary(e.target.value)}
              placeholder="Brief description of responsibilities or key team goals..."
              className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none font-sans"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{submitting ? "Adding..." : "Add to Dashboard"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}