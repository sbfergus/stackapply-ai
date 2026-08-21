"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
  RefreshCw,
  GripVertical,
  Plus,
  ChevronDown,
  FileText,
  FileUser,
  LogOut,
  User,
  Lightbulb,
} from "lucide-react";
import { JobDetailsDrawer } from "@/components/JobDetailsDrawer";
import { AddJobModal } from "@/components/AddJobModal";
import { ExtensionDownloadButton } from "@/components/ExtensionDownloadButton";
import { HeaderActions } from "@/components/HeaderActions";
import { OnboardingModal } from "@/components/OnboardingModal";
import { Job } from "@/types/job";

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

function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isGuest = searchParams.get("guest") === "true";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [apiKeyData, setApiKeyData] = useState<{
    hasKey: boolean;
    freeAnalysesRemaining: number;
    freeTierLimit: number;
    aiAnalysisCount: number;
  } | null>(null);
  const [loadingApiKey, setLoadingApiKey] = useState(true);
  const [skeletonCounts, setSkeletonCounts] = useState<Record<string, number>>({
    TO_REVIEW: 0,
    READY_TO_APPLY: 0,
    APPLIED: 0,
    INTERVIEWING: 0,
  });
  const [userData, setUserData] = useState<{
    hasResume: boolean;
    resumeHash: string | null;
  } | null>(null);
  const [calculatingMatchForJob, setCalculatingMatchForJob] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [generatingResumeForJob, setGeneratingResumeForJob] = useState<string | null>(null);

  // Auth check - redirect to sign in if not authenticated and not guest
  useEffect(() => {
    if (status === "loading") return;
    
    if (!session && !isGuest) {
      router.push("/");
    }
  }, [session, status, isGuest, router]);

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
    fetchApiKeyData();
    fetchUserData();
  }, []);

  const fetchApiKeyData = async () => {
    try {
      setLoadingApiKey(true);
      const url = isGuest ? '/api/user/api-key?guest=true' : '/api/user/api-key';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setApiKeyData(data.data);
          // Set useAI to true if user has analyses remaining or has their own key
          setUseAI(data.data.hasKey || data.data.freeAnalysesRemaining > 0);
        }
      }
    } catch (err) {
      console.error('Error fetching API key data:', err);
    } finally {
      setLoadingApiKey(false);
    }
  };

  const fetchUserData = async () => {
    try {
      const url = isGuest ? '/api/user?guest=true' : '/api/user';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUserData({
            hasResume: !!data.user.resumeUrl,
            resumeHash: data.user.resumeHash || null,
          });
          
          // Show onboarding if user hasn't seen it (and not in guest mode)
          if (!isGuest && data.user.hasSeenOnboarding === false) {
            setShowOnboarding(true);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
    }
  };

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
      const url = isGuest ? "/api/jobs?guest=true" : "/api/jobs";
      const res = await fetch(url);
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

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    
    // Mark onboarding as seen in database
    try {
      await fetch('/api/user/onboarding', {
        method: 'POST',
      });
    } catch (err) {
      console.error('Error saving onboarding status:', err);
    }
  };

  const handleGenerateResume = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();

    // Check prerequisites
    if (!userData?.hasResume) {
      alert("Please upload your resume in Account Settings to generate tailored resumes.");
      router.push("/account");
      return;
    }

    if (!useAI) {
      alert("Please enable the 'Use AI' toggle to generate resumes.");
      return;
    }

    const confirmGenerate = confirm(
      `Generate a tailored resume for ${job.company}?\n\nThis will use 1 AI analysis credit.`
    );

    if (!confirmGenerate) return;

    setGeneratingResumeForJob(job.id);

    try {
      const res = await fetch(`/api/jobs/${job.id}/generate-resume`, {
        method: 'POST',
      });

      if (res.ok) {
        // Download the PDF
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Get filename from Content-Disposition header or generate one
        const contentDisposition = res.headers.get('Content-Disposition');
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
        const filename = filenameMatch ? filenameMatch[1] : `resume-${job.company}-${new Date().toISOString().split('T')[0]}.pdf`;
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Refresh API key data to update credit counter
        fetchApiKeyData();

        alert(`Resume generated successfully!\n\nSaved as: ${filename}`);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to generate resume");
      }
    } catch (err) {
      console.error("Failed to generate resume:", err);
      alert("An error occurred while generating the resume");
    } finally {
      setGeneratingResumeForJob(null);
    }
  };

  const handleCalculateMatch = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check prerequisites
    if (!userData?.hasResume) {
      alert("Please upload your resume in Account Settings to calculate match scores.");
      router.push("/account");
      return;
    }

    if (!useAI) {
      alert("Please enable the 'Use AI' toggle to calculate match scores.");
      return;
    }

    setCalculatingMatchForJob(job.id);

    try {
      // Call the job parsing API with the existing job data
      const res = await fetch(`/api/jobs/${job.id}/calculate-match`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Update the job in state with new match score
        setJobs((prevJobs) =>
          prevJobs.map((j) => 
            j.id === job.id 
              ? { ...j, matchScore: data.matchScore, matchReasoning: data.matchReasoning } 
              : j
          )
        );
        
        // Update selected job if it's open
        if (selectedJob?.id === job.id) {
          setSelectedJob({ ...selectedJob, matchScore: data.matchScore, matchReasoning: data.matchReasoning });
        }
        
        // Refresh API key data to update the counter (in case free tier was used)
        fetchApiKeyData();
      } else {
        alert(data.error || "Failed to calculate match score");
      }
    } catch (err) {
      console.error("Failed to calculate match:", err);
      alert("An error occurred while calculating match score");
    } finally {
      setCalculatingMatchForJob(null);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Dashboard-specific Header Actions */}
      <HeaderActions>
        {/* Use AI Toggle */}
        <div className="relative group">
          <button
            onClick={() => setUseAI(!useAI)}
            disabled={loadingApiKey || !apiKeyData || (apiKeyData.freeAnalysesRemaining === 0 && !apiKeyData.hasKey)}
            className={`w-full md:w-auto flex items-center justify-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap ${
              loadingApiKey || !apiKeyData || (apiKeyData.freeAnalysesRemaining === 0 && !apiKeyData.hasKey)
                ? 'text-slate-400 bg-slate-900 border border-slate-800 cursor-not-allowed opacity-60'
                : 'text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white cursor-pointer'
            }`}
          >
            <span className="text-xs font-semibold shrink-0">Use AI</span>
            <div className="relative inline-block w-8 h-4 shrink-0">
              <input
                type="checkbox"
                checked={useAI}
                disabled={loadingApiKey || !apiKeyData || (apiKeyData.freeAnalysesRemaining === 0 && !apiKeyData.hasKey)}
                className="opacity-0 w-0 h-0"
                readOnly
              />
              <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all ${
                useAI ? 'bg-indigo-600' : 'bg-slate-700'
              }`}></span>
              <span className={`absolute bottom-0.5 w-3 h-3 rounded-full transition-all ${
                useAI ? 'left-4 bg-white' : 'left-0.5 bg-slate-500'
              }`}></span>
            </div>
            
            {/* Mobile: Always visible text inside button, to the right of toggle */}
            <span className="md:hidden text-[10px] text-slate-400 font-medium whitespace-nowrap ml-1">
              {loadingApiKey
                ? '...'
                : !apiKeyData
                ? 'Error'
                : apiKeyData.hasKey
                ? 'Your key'
                : `${apiKeyData.freeAnalysesRemaining}/${apiKeyData.freeTierLimit} free`
              }
            </span>
          </button>
          
          {/* Desktop: Hover tooltip */}
          <div className="hidden md:block invisible group-hover:visible absolute top-full left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 mt-2 bg-slate-800 text-slate-300 text-[10px] px-3 py-1.5 rounded-md border border-slate-700 whitespace-nowrap shadow-lg z-10">
            {loadingApiKey
              ? 'Loading...'
              : !apiKeyData
              ? 'Error loading data'
              : apiKeyData.hasKey
              ? 'Using your API key'
              : `${apiKeyData.freeAnalysesRemaining} of ${apiKeyData.freeTierLimit} free analyses remaining`
            }
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0 border-4 border-transparent border-b-slate-700"></div>
          </div>
        </div>

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
      </HeaderActions>

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

                                    {(() => {
                                      // Determine if match score is stale (resume content changed)
                                      const isStaleMatch = 
                                        job.matchScore && 
                                        job.matchCalculatedWithResumeHash && 
                                        userData?.resumeHash &&
                                        job.matchCalculatedWithResumeHash !== userData.resumeHash;

                                      // State 1: No match score yet
                                      if (!job.matchScore) {
                                        return (
                                          <button
                                            onClick={(e) => handleCalculateMatch(job, e)}
                                            disabled={!userData?.hasResume || calculatingMatchForJob === job.id || !useAI}
                                            className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-400 border border-indigo-800/50 hover:bg-indigo-900/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            title={
                                              !userData?.hasResume
                                                ? "Upload your resume in Account Settings to calculate matches"
                                                : !useAI
                                                ? "Enable 'Use AI' toggle to calculate match"
                                                : "Click to calculate match score"
                                            }
                                          >
                                            {calculatingMatchForJob === job.id ? "..." : "Calculate Match"}
                                          </button>
                                        );
                                      }

                                      // State 2: Valid match score (resume unchanged)
                                      if (!isStaleMatch) {
                                        return (
                                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                                            {job.matchScore}% Match
                                          </span>
                                        );
                                      }

                                      // State 3: Stale match score (resume changed)
                                      return (
                                        <button
                                          onClick={(e) => handleCalculateMatch(job, e)}
                                          disabled={!userData?.hasResume || calculatingMatchForJob === job.id || !useAI}
                                          className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/50 hover:bg-amber-900/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                          title={
                                            !userData?.hasResume
                                              ? "Upload your resume in Account Settings"
                                              : !useAI
                                              ? "Enable 'Use AI' toggle to calculate match"
                                              : "Your resume was updated. Click to recalculate match with your new resume."
                                          }
                                        >
                                          {calculatingMatchForJob === job.id ? "..." : "Recalculate Match"}
                                        </button>
                                      );
                                    })()}
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

                                  {/* PDF Generation Buttons - Only show in READY_TO_APPLY */}
                                  {job.status === "READY_TO_APPLY" && (
                                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-col gap-2">
                                      <button
                                        onClick={(e) => handleGenerateResume(job, e)}
                                        disabled={!userData?.hasResume || generatingResumeForJob === job.id || !useAI}
                                        className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded-md transition ${
                                          useAI && !generatingResumeForJob
                                            ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30"
                                            : "bg-slate-800/40 text-slate-500 border border-slate-700/40 cursor-not-allowed opacity-50"
                                        }`}
                                        title={
                                          !userData?.hasResume
                                            ? "Upload your resume in Account Settings to generate tailored resumes"
                                            : !useAI
                                            ? "Enable 'Use AI' toggle to generate resumes"
                                            : "Generate a tailored resume for this job (costs 1 AI credit)"
                                        }
                                      >
                                        <FileUser className="w-3 h-3 shrink-0" />
                                        <span className="whitespace-nowrap">
                                          {generatingResumeForJob === job.id ? "Generating..." : "Generate Resume"}
                                        </span>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // TODO: Implement cover letter generation
                                          console.log("Generate cover letter for:", job.id);
                                        }}
                                        disabled={!useAI}
                                        className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded-md transition ${
                                          useAI
                                            ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 hover:bg-indigo-600/30"
                                            : "bg-slate-800/40 text-slate-500 border border-slate-700/40 cursor-not-allowed opacity-50"
                                        }`}
                                      >
                                        <FileText className="w-3 h-3 shrink-0" />
                                        <span className="whitespace-nowrap">Generate Cover Letter</span>
                                      </button>
                                    </div>
                                  )}

                                  {/* Interview Notes Button - Only show in INTERVIEWING */}
                                  {job.status === "INTERVIEWING" && (
                                    <div className="mt-3 pt-3 border-t border-slate-800/60">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // TODO: Implement interview notes generation
                                          console.log("Generate interview notes for:", job.id);
                                        }}
                                        disabled={!useAI}
                                        className={`w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded-md transition ${
                                          useAI
                                            ? "bg-amber-600/20 text-amber-400 border border-amber-500/40 hover:bg-amber-600/30"
                                            : "bg-slate-800/40 text-slate-500 border border-slate-700/40 cursor-not-allowed opacity-50"
                                        }`}
                                      >
                                        <Lightbulb className="w-3 h-3 shrink-0" />
                                        <span className="whitespace-nowrap">Generate Interview Notes</span>
                                      </button>
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
        userHasProfile={userData?.hasResume || false}
      />

      {/* Manual Add Job Modal */}
      <AddJobModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onJobAdded={handleJobAdded}
        isGuest={isGuest}
      />

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
      />
    </div>
  );
}

// Loading fallback component
function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        <p className="mt-4 text-slate-400 text-sm">Loading dashboard...</p>
      </div>
    </div>
  );
}

// Default export with Suspense boundary
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}