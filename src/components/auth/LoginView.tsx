"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import AuthModal from "@/components/auth/AuthModal";
import { TrackrLogo } from "@/components/common/TrackrLogo";

export default function LoginView({
  ssoError,
  next = "/projects",
}: {
  ssoError?: string;
  next?: string;
}) {
  const [dismissedError, setDismissedError] = useState(false);

  return (
    <div className="min-h-screen w-full bg-surface-sunk flex flex-col items-center justify-center gap-6 p-4">
      <TrackrLogo size="lg" />

      <Link prefetch={false}
        href="/projects"
        className="text-xs text-ink-2 hover:text-accent font-medium"
      >
        &larr; Continue without signing in
      </Link>

      {ssoError && !dismissedError && (
        <div className="max-w-lg w-full p-3 rounded-md bg-danger-soft border border-danger/30 text-danger text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-danger mt-0.5" />
          <span className="flex-1">{ssoError}</span>
          <button
            onClick={() => setDismissedError(true)}
            className="text-danger hover:text-danger font-semibold"
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
          // A full navigation rather than router.replace + refresh: the two
          // race, and the refresh can cancel the pending navigation, leaving
          // someone signed in but still looking at the sign-in form. It also
          // guarantees the root layout re-renders with the new session.
          window.location.assign(next);
        }}
      />
    </div>
  );
}
