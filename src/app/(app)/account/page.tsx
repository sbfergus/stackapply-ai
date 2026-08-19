"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail, Calendar, Key, Trash2 } from "lucide-react";

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

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

  const userEmail = session.user?.email || "No email";
  const userInitial = userEmail.charAt(0).toUpperCase();

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
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <span className="text-3xl font-bold text-white">
                      {userInitial}
                    </span>
                  </div>
                </div>

                {/* User Info */}
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </label>
                    <div className="text-slate-200 font-medium">{userEmail}</div>
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
                  <div className="text-2xl font-bold text-white">0</div>
                  <div className="text-xs text-slate-400">Jobs Saved</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">0</div>
                  <div className="text-xs text-slate-400">Applications</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">0</div>
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
            <button className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition shadow-lg shadow-red-600/20">
              Delete Account
            </button>
          </div>
        </section>
    </div>
  );
}
