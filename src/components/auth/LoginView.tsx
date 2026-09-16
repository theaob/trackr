"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import AuthModal from "@/components/auth/AuthModal";
import { TrackrLogo } from "@/components/common/TrackrLogo";

export default function LoginView({ ssoError }: { ssoError?: string }) {
  const router = useRouter();
  const [dismissedError, setDismissedError] = useState(false);

  return (
    <div className="min-h-screen w-full bg-jira-gray-100 flex flex-col items-center justify-center gap-6 p-4">
      <TrackrLogo size="lg" />

      {ssoError && !dismissedError && (
        <div className="max-w-lg w-full p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span className="flex-1">{ssoError}</span>
          <button
            onClick={() => setDismissedError(true)}
            className="text-rose-500 hover:text-rose-700 font-semibold"
          >
            ×
          </button>
        </div>
      )}

      <AuthModal
        isOpen
        dismissible={false}
        onClose={() => {}}
        onSuccess={() => {
          router.replace("/projects");
          router.refresh();
        }}
      />
    </div>
  );
}
