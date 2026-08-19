"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Mail, Calendar, Key, Trash2, Camera, Pencil } from "lucide-react";
import DeleteAccountModal from "@/components/DeleteAccountModal";
import EditEmailModal from "@/components/EditEmailModal";

interface JobStats {
  totalJobs: number;
  appliedJobs: number;
  interviewingJobs: number;
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
  const [currentEmail, setCurrentEmail] = useState(session?.user?.email || "");
  const [showToast, setShowToast] = useState(false);
  const [toastExiting, setToastExiting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      } catch (err) {
        console.error("Error fetching user avatar:", err);
      }
    };

    if (status === "authenticated") {
      fetchUserAvatar();
    }
  }, [session, status]);

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
              
              <div className="flex items-start gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
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
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </label>
                    <div className="flex items-center justify-between group">
                      <div className="text-slate-200 font-medium">{userEmail}</div>
                      <button
                        onClick={() => setShowEditEmailModal(true)}
                        className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-lg transition opacity-0 group-hover:opacity-100"
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
                <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
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
                  <button className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                    Change
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar - Stats */}
          <div className="space-y-6">
            <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Quick Stats
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {loadingStats ? "..." : stats.totalJobs}
                  </div>
                  <div className="text-xs text-slate-400">Jobs Saved</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {loadingStats ? "..." : stats.appliedJobs + stats.interviewingJobs}
                  </div>
                  <div className="text-xs text-slate-400">Jobs Applied To</div>
                </div>
                <div>
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
          
          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-red-900/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
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
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition shadow-lg shadow-red-600/20"
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
              <p className="text-sm font-semibold text-green-200">Email Updated!</p>
              <p className="text-xs text-green-300 mt-0.5">Your email address has been successfully updated.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
