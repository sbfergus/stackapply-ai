"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  Briefcase,
  Building2,
  MapPin,
  Banknote,
  Sparkles,
  RefreshCw,
  GripVertical,
  Plus,
  ChevronDown,
} from "lucide-react";
import { JobDetailsDrawer } from "@/components/JobDetailsDrawer";
import { AddJobModal } from "@/components/AddJobModal";
import { ExtensionDownloadButton } from "@/components/ExtensionDownloadButton";

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

const STAGES = [
  { id: "TO_REVIEW", label: "To Review", color: "border-amber-500/40 text-amber-400 bg-amber-500/10" },
  { id: "READY_TO_APPLY", label: "Ready to Apply", color: "border-blue-500/40 text-blue-400 bg-blue-500/10" },
  { id: "APPLIED", label: "Applied", color: "border-purple-500/40 text-purple-400 bg-purple-500/10" },
  { id: "INTERVIEWING", label: "Interviewing", color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" },
];

// Helper function to format salary
const formatSalary = (amount: number): string => {
  if (amount >= 1000000) {
    const millions = amount / 1000000;
    return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(2).replace(/\.?0+$/, '')}M`;
  } else {
    return `$${(amount / 1000).toFixed(0)}k`;
  }
};

// Skeleton card component
const SkeletonJobCard = () => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 animate-pulse">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 bg-slate-800 rounded" />
        <div className="w-3.5 h-3.5 bg-slate-800 rounded" />
        <div className="h-3 w-20 bg-slate-800 rounded" />
      </div>
      <div className="h-4 w-16 bg-slate-800 rounded-full" />
    </div>
    
    <div className="h-4 w-full bg-slate-800 rounded mb-2.5" />
    
    <div className="space-y-1 mb-3">
      <div className="h-3 w-3/4 bg-slate-800 rounded" />
      <div className="h-3 w-1/2 bg-slate-800 rounded" />
    </div>
    
    <div className="flex flex-wrap gap-1.5">
      <div className="h-5 w-16 bg-slate-800 rounded" />
      <div className="h-5 w-20 bg-slate-800 rounded" />
      <div className="h-5 w-14 bg-slate-800 rounded" />
    </div>
  </div>
);

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [skeletonCounts, setSkeletonCounts] = useState<Record<string, number>>({
    TO_REVIEW: 0,
    READY_TO_APPLY: 0,
    APPLIED: 0,
    INTERVIEWING: 0,
  });

  // Drawer and Modal States
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    const cached = localStorage.getItem('jobColumnCounts');
    if (cached) {
      try {
        setSkeletonCounts(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to parse cached counts:', e);
      }
    }
    
    fetchJobs();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      if (openDropdownId) {
        setOpenDropdownId(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdownId]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs);
        
        const counts = STAGES.reduce((acc, stage) => {
          acc[stage.id] = data.jobs.filter((j: Job) => j.status === stage.id).length;
          return acc;
        }, {} as Record<string, number>);
        
        setSkeletonCounts(counts);
        localStorage.setItem('jobColumnCounts', JSON.stringify(counts));
      }
    } catch (err) {
      console.error("Error loading jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (job: Job) => {
    setSelectedJob(job);
    setIsDrawerOpen(true);
  };

  const handleJobUpdated = (updatedJob: Job) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === updatedJob.id ? updatedJob : j))
    );
    setSelectedJob(updatedJob);
  };

  const handleJobDeleted = (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    setSelectedJob(null);
  };

  const handleJobAdded = (newJob: Job) => {
    setJobs((prev) => [newJob, ...prev]);
  };

  const handleStatusChangeFromDropdown = async (jobId: string, newStatus: Job["status"]) => {
    setOpenDropdownId(null);

    setJobs((prevJobs) =>
      prevJobs.map((job) => {
        if (job.id === jobId) {
          const updatedJob = { ...job, status: newStatus };
          if (selectedJob?.id === jobId) {
            setSelectedJob(updatedJob);
          }
          return updatedJob;
        }
        return job;
      })
    );

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        fetchJobs();
      }
    } catch (err) {
      console.error("Failed to update job status:", err);
      fetchJobs();
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newStatus = destination.droppableId as Job["status"];

    setJobs((prevJobs) =>
      prevJobs.map((job) => {
        if (job.id === draggableId) {
          const updatedJob = { ...job, status: newStatus };
          if (selectedJob?.id === draggableId) {
            setSelectedJob(updatedJob);
          }
          return updatedJob;
        }
        return job;
      })
    );

    try {
      const res = await fetch(`/api/jobs/${draggableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        fetchJobs();
      }
    } catch (err) {
      console.error("Failed to update job status:", err);
      fetchJobs();
    }
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-indigo-600/20 rounded-xl border border-indigo-500/30 text-indigo-400">
              <Briefcase className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent whitespace-nowrap">
              StackApply.ai
            </h1>
          </div>
          <p className="hidden md:block text-xs text-slate-400 ml-11">
            Automated job tracking, candidate matching, and AI resume tailoring
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
          <ExtensionDownloadButton />

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/20 transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Job
          </button>

          <button
            onClick={fetchJobs}
            className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-white transition whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* Drag & Drop Context */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STAGES.map((stage) => {
            const stageJobs = jobs.filter((j) => j.status === stage.id);

            return (
              <div
                key={stage.id}
                className="flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 min-h-[500px]"
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${stage.color}`}
                  >
                    {stage.label}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {stageJobs.length}
                  </span>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={stage.id} type="JOB">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 space-y-3 rounded-xl p-1 ${
                        snapshot.isDraggingOver
                          ? "bg-slate-800/40 border border-dashed border-indigo-500/40"
                          : ""
                      }`}
                    >
                      {loading ? (
                        Array.from({ length: skeletonCounts[stage.id] || 0 }).map((_, i) => (
                          <SkeletonJobCard key={`skeleton-${stage.id}-${i}`} />
                        ))
                      ) : stageJobs.length === 0 ? (
                        <div className="h-32 flex items-center justify-center border border-dashed border-slate-800/80 rounded-xl">
                          <p className="text-xs text-slate-600">
                            No jobs in this stage
                          </p>
                        </div>
                      ) : (
                        stageJobs.map((job, index) => (
                          <Draggable
                            key={job.id}
                            draggableId={job.id}
                            index={index}
                          >
                            {(provided, snapshot) => {
                              const usePortal = snapshot.isDragging;

                              const maxVisible = 5;
                              const hasOverflow = job.techStack.length > maxVisible;
                              const visibleTech = hasOverflow ? job.techStack.slice(0, maxVisible) : job.techStack;
                              const hiddenCount = job.techStack.length - maxVisible;

                              const isRedundantSetting =
                                job.location &&
                                job.workSetting &&
                                job.location.toLowerCase().includes(job.workSetting.toLowerCase());

                              const cardContent = (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  onClick={() => handleCardClick(job)}
                                  style={{
                                    ...provided.draggableProps.style,
                                    zIndex: snapshot.isDragging ? 9999 : "auto",
                                  }}
                                  className={`bg-slate-900 border border-slate-800 rounded-xl p-3.5 group select-none transition-all cursor-pointer ${
                                    snapshot.isDragging
                                      ? "shadow-2xl ring-2 ring-indigo-500 border-indigo-500 bg-slate-850"
                                      : "hover:border-slate-700/80 hover:shadow-md"
                                  }`}
                                >
                                  {/* Top Meta Row */}
                                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                                    <div className="flex items-center gap-1.5 font-medium text-slate-300 min-w-0 pr-2">
                                      <div className="relative">
                                        <div
                                          {...provided.dragHandleProps}
                                          onClick={(e) => e.stopPropagation()}
                                          className="hidden md:block cursor-grab active:cursor-grabbing p-0.5 text-slate-600 hover:text-slate-300 rounded shrink-0 transition-colors"
                                        >
                                          <GripVertical className="w-3.5 h-3.5" />
                                        </div>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenDropdownId(openDropdownId === job.id ? null : job.id);
                                          }}
                                          className="md:hidden p-0.5 text-slate-600 hover:text-slate-300 rounded shrink-0 transition-colors"
                                        >
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        </button>

                                        {openDropdownId === job.id && (
                                          <div className="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]">
                                            {STAGES.map((stage) => (
                                              <button
                                                key={stage.id}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleStatusChangeFromDropdown(job.id, stage.id as Job["status"]);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700 transition ${
                                                  job.status === stage.id ? "text-indigo-400 font-semibold" : "text-slate-300"
                                                }`}
                                              >
                                                {stage.label}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                      <span className="truncate">{job.company}</span>
                                    </div>

                                    {job.matchScore && (
                                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                                        {job.matchScore}% Match
                                      </span>
                                    )}
                                  </div>

                                  {/* Job Title */}
                                  <h3 className="font-semibold text-sm text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug mb-2.5">
                                    {job.title}
                                  </h3>

                                  {/* Dedicated Metadata Rows */}
                                  <div className="space-y-1 text-xs text-slate-400 mb-3">
                                    {job.location && (
                                      <div className="flex items-center gap-1.5 text-slate-400">
                                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        <span className="truncate">
                                          {job.location}
                                          {!isRedundantSetting && job.workSetting && ` (${job.workSetting === "IN_OFFICE" ? "In-Office" : job.workSetting})`}
                                        </span>
                                      </div>
                                    )}

                                    {(job.salaryMin || job.salaryMax) && (
                                      <div className="flex items-center gap-1 font-medium text-emerald-400/90">
                                        <Banknote className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>
                                          {formatSalary(job.salaryMin!)} - {formatSalary(job.salaryMax!)}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Tech Stack Pills */}
                                  {job.techStack.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {visibleTech.map((tech) => (
                                        <span
                                          key={tech}
                                          className="text-[10px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700/50 font-mono h-fit"
                                        >
                                          {tech.toUpperCase()}
                                        </span>
                                      ))}
                                      {hasOverflow && (
                                        <span className="text-[10px] bg-slate-800/40 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800 font-mono h-fit">
                                          +{hiddenCount} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );

                              if (usePortal) {
                                return createPortal(cardContent, document.body);
                              }

                              return cardContent;
                            }}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Slide-Over Job Details Drawer */}
      <JobDetailsDrawer
        job={selectedJob}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onJobUpdated={handleJobUpdated}
        onJobDeleted={handleJobDeleted}
      />

      {/* Manual Add Job Modal */}
      <AddJobModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onJobAdded={handleJobAdded}
      />
    </div>
  );
}