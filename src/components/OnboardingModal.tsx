"use client";

import { useState } from "react";
import { X, Sparkles, Download, BarChart3, Briefcase } from "lucide-react";

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

const STEPS = [
  {
    id: 1,
    icon: Sparkles,
    title: "Welcome to StackApply.ai!",
    description: "Your AI-powered job tracking assistant that saves you hours every week",
    visual: "🎉",
    primaryAction: "Get Started",
    secondaryAction: "Skip Tour",
  },
  {
    id: 2,
    icon: Download,
    title: "Install the Browser Extension",
    description: "Save jobs from LinkedIn, Indeed, or any job site with one click. Everything syncs to your dashboard instantly.",
    visual: "🔌",
    primaryAction: "Download Extension",
    secondaryAction: "Next",
    downloadButton: true,
  },
  {
    id: 3,
    icon: BarChart3,
    title: "AI-Powered Matching",
    description: "Upload your resume and get instant match scores for every job. See exactly why you're a great fit.",
    visual: "✨",
    badge: "92% Match",
    primaryAction: "Next",
    secondaryAction: "Back",
  },
  {
    id: 4,
    icon: Briefcase,
    title: "Track Your Pipeline",
    description: "Organize jobs into stages: To Review → Ready to Apply → Applied → Interviewing. Drag and drop to update.",
    visual: "📊",
    primaryAction: "Start Tracking Jobs",
    secondaryAction: "Back",
  },
];

export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;
  const Icon = step.icon;

  const handlePrimary = () => {
    if (step.downloadButton) {
      // Download extension
      const link = document.createElement('a');
      link.href = '/stackapply-extension.zip';
      link.download = 'stackapply-extension.zip';
      link.click();
      setCurrentStep(currentStep + 1);
    } else if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSecondary = () => {
    if (isFirstStep) {
      onComplete(); // Skip tour
    } else if (step.secondaryAction === "Back") {
      setCurrentStep(currentStep - 1);
    } else {
      setCurrentStep(currentStep + 1); // Next
    }
  };

  const handleClose = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-auto overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="px-6 sm:px-8 py-8 sm:py-10">
          {/* Icon & Visual */}
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              {/* Background gradient circle */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-2xl" />
              
              {/* Icon container */}
              <div className="relative p-4 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl border border-indigo-500/30 shadow-lg">
                <Icon className="w-8 h-8 text-white" />
              </div>
              
              {/* Emoji overlay */}
              {step.visual && (
                <div className="absolute -bottom-2 -right-2 text-3xl">
                  {step.visual}
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3 bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            {step.title}
          </h2>

          {/* Description */}
          <p className="text-slate-400 text-center text-sm sm:text-base leading-relaxed mb-8 max-w-md mx-auto">
            {step.description}
          </p>

          {/* Match Badge Example (Step 3) */}
          {step.badge && (
            <div className="flex justify-center mb-8">
              <div className="px-4 py-2 bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 rounded-full text-sm font-bold shadow-lg">
                {step.badge}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSecondary}
              className="flex-1 px-6 py-3 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              {step.secondaryAction}
            </button>
            <button
              onClick={handlePrimary}
              className="flex-1 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg shadow-md shadow-indigo-600/20 transition"
            >
              {step.primaryAction}
            </button>
          </div>
        </div>

        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-2 pb-6">
          {STEPS.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentStep
                  ? "w-8 bg-indigo-500"
                  : "w-2 bg-slate-700 hover:bg-slate-600"
              }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
