"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Mail, Calendar, Key, Trash2, Camera, Pencil, FileText, Upload, Sparkles } from "lucide-react";
import DeleteAccountModal from "@/components/DeleteAccountModal";
import EditEmailModal from "@/components/EditEmailModal";
import EditPasswordModal from "@/components/EditPasswordModal";
import AddApiKeyModal from "@/components/AddApiKeyModal";

interface JobStats {
  totalJobs: number;
  appliedJobs: number;
  interviewingJobs: number;
}

interface ApiKeyData {
  hasKey: boolean;
  provider: 'ANTHROPIC' | 'OPENAI' | null;
  keyMasked: string;
  aiAnalysisCount: number;
  freeAnalysesRemaining: number;
}

export default function AccountPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<JobStats>({
    totalJobs: 0,
    appliedJobs: 0,
    interviewingJobs: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditEmailModal, setShowEditEmailModal] = useState(false);
  const [showEditPasswordModal, setShowEditPasswordModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [currentEmail, setCurrentEmail] = useState(session?.user?.email || "");
  const [showToast, setShowToast] = useState(false);
  const [toastExiting, setToastExiting] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: "", description: "" });
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [apiKeyData, setApiKeyData] = useState<ApiKeyData>({
    hasKey: false,
    provider: null,
    keyMasked: '',
    aiAnalysisCount: 0,
    freeAnalysesRemaining: 5,
  });
  const [loadingApiKey, setLoadingApiKey] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    // Avatar will be loaded from session
    if (session?.user?.email) {
      setCurrentEmail(session.user.email);
    }
  }, [session]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Fetch job statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/jobs");
        const data = await res.json();
        
        if (data.success) {
          const jobs = data.jobs;
          setStats({
            totalJobs: jobs.length,
            appliedJobs: jobs.filter((j: any) => j.status === "APPLIED").length,
            interviewingJobs: jobs.filter((j: any) => j.status === "INTERVIEWING").length,
          });
        }
      } catch (err) {
        console.error("Error loading job stats:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    if (status === "authenticated") {
      fetchStats();
    }
  }, [status]);

  // Fetch user avatar
  useEffect(() => {
    const fetchUserAvatar = async () => {
      if (!session?.user?.email) return;
      
      try {
        const res = await fetch("/api/user");
        const data = await res.json();
        if (data.success && data.user?.avatarUrl) {
          setAvatarUrl(data.user.avatarUrl);
        }
        if (data.success && data.user?.resumeUrl) {
          setResumeUrl(data.user.resumeUrl);
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    if (status === "authenticated") {
      fetchUserAvatar();
    }
  }, [session, status]);

  // Fetch API key status
  useEffect(() => {
    const fetchApiKeyStatus = async () => {
      try {
        const res = await fetch('/api/user/api-key');
        const data = await res.json();
        if (data.success) {
          setApiKeyData(data.data);
        }
      } catch (error) {
        console.error('Error fetching API key status:', error);
      } finally {
        setLoadingApiKey(false);
      }
    };

    if (status === 'authenticated') {
      fetchApiKeyStatus();
    }
  }, [status]);

  if (!mounted || status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const userEmail = currentEmail || session.user?.email || "No email";
  const userInitial = userEmail.charAt(0).toUpperCase();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    setUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success && data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent("avatarUpdated", { detail: { avatarUrl: data.avatarUrl } }));
      } else {
        alert(data.error || "Failed to upload avatar");
      }
    } catch (error) {
      console.error("Avatar upload error:", error);
      alert("Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteAvatar = async () => {
    try {
      const res = await fetch("/api/user/avatar", {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        setAvatarUrl(null);
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent("avatarUpdated", { detail: { avatarUrl: null } }));
      } else {
        alert(data.error || "Failed to delete avatar");
      }
    } catch (error) {
      console.error("Avatar deletion error:", error);
      alert("Failed to delete avatar");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const res = await fetch("/api/user/delete", {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        // Sign out and redirect to home
        await signOut({ callbackUrl: "/" });
      } else {
        alert(data.error || "Failed to delete account");
        setShowDeleteModal(false);
      }
    } catch (error) {
      console.error("Account deletion error:", error);
      alert("Failed to delete account");
      setShowDeleteModal(false);
    }
  };

  const handleEmailUpdate = async (newEmail: string) => {
    // Update local state immediately
    setCurrentEmail(newEmail);
    
    // Trigger NextAuth session update to fetch new email from database
    await update();
    
    // Show toast notification
    setToastMessage({
      title: "Email Updated!",
      description: "Your email address has been successfully updated."
    });
    showToastNotification();
  };

  const handlePasswordUpdate = () => {
    // Show toast notification
    setToastMessage({
      title: "Password Updated!",
      description: "Your password has been successfully changed."
    });
    showToastNotification();
  };

  const showToastNotification = () => {
    setShowToast(true);
    setToastExiting(false);
    
    // Start exit animation after 2.7 seconds (total 3 seconds including animation)
    setTimeout(() => {
      setToastExiting(true);
    }, 2700);
    
    // Remove toast after exit animation completes
    setTimeout(() => {
      setShowToast(false);
      setToastExiting(false);
    }, 3000);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      alert("Please select a PDF file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    setUploadingResume(true);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const res = await fetch("/api/user/resume", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success && data.resumeUrl) {
        setResumeUrl(data.resumeUrl);
        setToastMessage({
          title: "Resume Uploaded!",
          description: "Your resume has been successfully uploaded."
        });
        showToastNotification();
      } else {
        alert(data.error || "Failed to upload resume");
      }
    } catch (error) {
      console.error("Resume upload error:", error);
      alert("Failed to upload resume");
    } finally {
      setUploadingResume(false);
    }
  };

  const handleResumeClick = () => {
    resumeInputRef.current?.click();
  };

  const handleDeleteResume = async () => {
    if (!confirm("Are you sure you want to delete your resume?")) return;

    try {
      const res = await fetch("/api/user/resume", {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        setResumeUrl(null);
        setToastMessage({
          title: "Resume Deleted",
          description: "Your resume has been removed."
        });
        showToastNotification();
      } else {
        alert(data.error || "Failed to delete resume");
      }
    } catch (error) {
      console.error("Resume deletion error:", error);
      alert("Failed to delete resume");
    }
  };

  const handleApiKeySuccess = async () => {
    // Refresh API key status
    try {
      const res = await fetch('/api/user/api-key');
      const data = await res.json();
      if (data.success) {
        setApiKeyData(data.data);
      }
      setToastMessage({
        title: 'API Key Added!',
        description: 'Your API key has been successfully saved and validated.',
      });
      showToastNotification();
    } catch (error) {
      console.error('Error refreshing API key status:', error);
    }
  };

  const handleRemoveApiKey = async () => {
    if (!confirm('Are you sure you want to remove your API key? You will fall back to the free tier (5 analyses).')) {
      return;
    }

    try {
      const res = await fetch('/api/user/api-key', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        setApiKeyData({
          hasKey: false,
          provider: null,
          keyMasked: '',
          aiAnalysisCount: apiKeyData.aiAnalysisCount,
          freeAnalysesRemaining: Math.max(0, 5 - apiKeyData.aiAnalysisCount),
        });
        setToastMessage({
          title: 'API Key Removed',
          description: 'Your API key has been removed from your account.',
        });
        showToastNotification();
      } else {
        alert(data.error || 'Failed to remove API key');
      }
    } catch (error) {
      console.error('API key removal error:', error);
      alert('Failed to remove API key');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Account Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your profile and account preferences
        </p>
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Section */}
            <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Profile Information</h2>
              
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0 mx-auto md:mx-0">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 overflow-hidden">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl font-bold text-white">
                          {userInitial}
                        </span>
                      )}
                    </div>
                    
                    {/* Overlay with Upload/Delete Buttons */}
                    <div className="absolute inset-0 w-24 h-24 rounded-full bg-slate-900/70 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={handleAvatarClick}
                        disabled={uploadingAvatar}
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                        title="Upload avatar"
                      >
                        <Camera className="w-5 h-5 text-white" />
                      </button>
                      
                      {avatarUrl && (
                        <button
                          onClick={handleDeleteAvatar}
                          disabled={uploadingAvatar}
                          className="p-2 hover:bg-red-600 rounded-full transition-colors"
                          title="Remove avatar"
                        >
                          <Trash2 className="w-5 h-5 text-white" />
                        </button>
                      )}
                    </div>
                    
                    {/* Hidden File Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    
                    {uploadingAvatar && (
                      <div className="absolute inset-0 w-24 h-24 rounded-full bg-slate-900/90 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </div>

                {/* User Info */}
                <div className="flex-1 space-y-4 w-full">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </label>
                    <div className="flex items-center justify-between group">
                      <div className="text-slate-200 font-medium truncate mr-2">{userEmail}</div>
                      <button
                        onClick={() => setShowEditEmailModal(true)}
                        className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-lg transition opacity-0 md:group-hover:opacity-100 md:opacity-0 opacity-100 flex-shrink-0"
                        title="Edit email address"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      <Calendar className="w-4 h-4" />
                      Member Since
                    </label>
                    <div className="text-slate-200 font-medium">
                      {new Date().toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Security Section */}
            <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Security</h2>
              
              <div className="space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                      <Key className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        Password
                      </p>
                      <p className="text-xs text-slate-400">
                        Last changed recently
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowEditPasswordModal(true)}
                    className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                  >
                    Change
                  </button>
                </div>
              </div>
            </section>

            {/* API Keys Section */}
            <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">API Keys</h2>
                {!loadingApiKey && !apiKeyData.hasKey && (
                  <span className="text-xs text-slate-400">
                    {apiKeyData.freeAnalysesRemaining} of 5 free analyses remaining
                  </span>
                )}
              </div>
              
              {loadingApiKey ? (
                <div className="flex items-center justify-center p-8">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Usage Counter (if no custom key) */}
                  {!apiKeyData.hasKey && (
                    <div className="mb-4 p-4 bg-indigo-950/30 border border-indigo-900/50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-indigo-300 mb-1">
                            Free Tier: <strong>{apiKeyData.freeAnalysesRemaining} of 5</strong> AI analyses remaining
                          </p>
                          <p className="text-xs text-indigo-400/80">
                            Add your own API key below for unlimited analyses
                          </p>
                        </div>
                      </div>
                      {apiKeyData.freeAnalysesRemaining === 0 && (
                        <div className="mt-3 pt-3 border-t border-indigo-900/50">
                          <p className="text-xs text-red-400">
                            ⚠️ Free limit reached. Add your API key to continue using AI features.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Key Status */}
                  {apiKeyData.hasKey ? (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                          <Key className="w-5 h-5 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200">
                            Connected to {apiKeyData.provider === 'ANTHROPIC' ? 'Anthropic' : 'OpenAI'}
                          </p>
                          <p className="text-xs text-slate-400 font-mono truncate">
                            {apiKeyData.keyMasked}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveApiKey}
                        className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowApiKeyModal(true)}
                      className="w-full p-6 bg-slate-900/50 hover:bg-slate-900/70 rounded-lg border-2 border-dashed border-slate-700 hover:border-indigo-500/50 transition text-center group"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 flex items-center justify-center transition">
                          <Key className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200 mb-1">
                            Add Your API Key
                          </p>
                          <p className="text-xs text-slate-400">
                            Use your own Anthropic or OpenAI key for unlimited AI analyses
                          </p>
                        </div>
                      </div>
                    </button>
                  )}
                </>
              )}
            </section>

            {/* Resume Section */}
            <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Resume</h2>
                {resumeUrl && !uploadingResume && (
                  <a
                    href={resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                  >
                    View Resume
                  </a>
                )}
              </div>
              
              <div className="space-y-3">
                {resumeUrl ? (
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {resumeUrl.split('/').pop()?.split('?')[0] || 'Resume.pdf'}
                        </p>
                        <p className="text-xs text-slate-400">
                          PDF • Used for job matching
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2 md:flex-shrink-0">
                      <button 
                        onClick={handleResumeClick}
                        disabled={uploadingResume}
                        className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Replace
                      </button>
                      <button 
                        onClick={handleDeleteResume}
                        disabled={uploadingResume}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-900/50 rounded-lg border-2 border-dashed border-slate-700 hover:border-indigo-500/50 transition">
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto rounded-lg bg-indigo-500/10 flex items-center justify-center mb-3">
                        <Upload className="w-6 h-6 text-indigo-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-200 mb-1">
                        Upload your resume
                      </p>
                      <p className="text-xs text-slate-400 mb-4">
                        PDF up to 5MB • Used for job matching & resume generation
                      </p>
                      <button
                        onClick={handleResumeClick}
                        disabled={uploadingResume}
                        className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                      >
                        {uploadingResume ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Choose File
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Hidden File Input */}
                <input
                  ref={resumeInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleResumeUpload}
                  className="hidden"
                />
              </div>
            </section>
          </div>

          {/* Sidebar - Stats */}
          <div className="space-y-6">
            <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-center lg:text-left">
                Quick Stats
              </h3>
              <div className="space-y-4">
                <div className="text-center lg:text-left">
                  <div className="text-2xl font-bold text-white">
                    {loadingStats ? "..." : stats.totalJobs}
                  </div>
                  <div className="text-xs text-slate-400">Jobs Saved</div>
                </div>
                <div className="text-center lg:text-left">
                  <div className="text-2xl font-bold text-white">
                    {loadingStats ? "..." : stats.appliedJobs + stats.interviewingJobs}
                  </div>
                  <div className="text-xs text-slate-400">Jobs Applied To</div>
                </div>
                <div className="text-center lg:text-left">
                  <div className="text-2xl font-bold text-white">
                    {loadingStats ? "..." : stats.interviewingJobs}
                  </div>
                  <div className="text-xs text-slate-400">Interviews</div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Danger Zone - Full Width */}
        <section className="mt-6 bg-red-950/20 border border-red-900/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-red-400 mb-4">
            Danger Zone
          </h2>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 bg-slate-900/50 rounded-lg border border-red-900/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Delete Account
                </p>
                <p className="text-xs text-slate-400">
                  Permanently delete your account and all data
                </p>
              </div>
            </div>
            <button 
              onClick={() => setShowDeleteModal(true)}
              className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition shadow-lg shadow-red-600/20"
            >
              Delete Account
            </button>
          </div>
        </section>

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        userEmail={userEmail}
      />

      {/* Edit Email Modal */}
      <EditEmailModal
        isOpen={showEditEmailModal}
        onClose={() => setShowEditEmailModal(false)}
        onSuccess={handleEmailUpdate}
        currentEmail={userEmail}
      />

      {/* Edit Password Modal */}
      <EditPasswordModal
        isOpen={showEditPasswordModal}
        onClose={() => setShowEditPasswordModal(false)}
        onSuccess={handlePasswordUpdate}
      />

      {/* Add API Key Modal */}
      <AddApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSuccess={handleApiKeySuccess}
      />

      {/* Toast Notification */}
      {showToast && (
        <div className={`fixed top-4 right-4 z-50 ${toastExiting ? 'animate-slide-out' : 'animate-slide-in'}`}>
          <div className="flex items-start gap-3 p-4 bg-green-950/90 border border-green-900/50 rounded-lg shadow-2xl backdrop-blur-sm min-w-[300px]">
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-200">{toastMessage.title}</p>
              <p className="text-xs text-green-300 mt-0.5">{toastMessage.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
