"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Briefcase, LogOut, User } from "lucide-react";

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const isGuest = searchParams.get("guest") === "true";

  // Load avatar from API
  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const res = await fetch("/api/user");
        const data = await res.json();
        if (data.success && data.user?.avatarUrl) {
          setAvatarUrl(data.user.avatarUrl);
        }
      } catch (error) {
        console.error("Error fetching avatar:", error);
      }
    };

    fetchAvatar();

    // Listen for avatar updates
    const handleAvatarUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      setAvatarUrl(customEvent.detail?.avatarUrl || null);
    };

    window.addEventListener("avatarUpdated", handleAvatarUpdate);
    return () => window.removeEventListener("avatarUpdated", handleAvatarUpdate);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowUserMenu(false);
    if (showUserMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showUserMenu]);

  const handleSignOut = async () => {
    localStorage.removeItem("isGuest");
    await signOut({ callbackUrl: "/" });
  };

  const userEmail = session?.user?.email || "Guest User";
  const userInitial = isGuest 
    ? "G" 
    : (session?.user?.name?.charAt(0).toUpperCase() || userEmail.charAt(0).toUpperCase());

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      {/* Shared Header */}
      <header className="max-w-7xl mx-auto mb-8 space-y-4">
        {/* Top Row: Logo/Title and Avatar - Always horizontal */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
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

          {/* User Avatar - Always in top right */}
          <div className="relative shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
              }}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-slate-800 shadow-lg hover:border-indigo-500 transition-all cursor-pointer overflow-hidden"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-white">
                  {userInitial}
                </span>
              )}
            </button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
                <div className="px-3 py-2 border-b border-slate-700">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {isGuest ? "Guest Mode" : "Account"}
                  </p>
                  {!isGuest && session?.user?.email && (
                    <p className="text-xs text-slate-300 mt-0.5 truncate">
                      {session.user.email}
                    </p>
                  )}
                </div>

                {!isGuest && pathname !== "/account" && (
                  <Link
                    href="/account"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition"
                  >
                    <User className="w-4 h-4" />
                    <span>Account</span>
                  </Link>
                )}

                {!isGuest && pathname === "/account" && (
                  <Link
                    href="/dashboard"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition"
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>
                )}

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Row - Can stack on mobile if needed */}
        <div id="header-actions" className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3" />
      </header>

      {/* Page Content */}
      {children}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-slate-400">Loading...</div>
        </div>
      </div>
    }>
      <AppLayoutContent>{children}</AppLayoutContent>
    </Suspense>
  );
}
