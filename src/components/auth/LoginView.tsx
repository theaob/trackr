"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import SignInCard from "@/components/auth/SignInCard";
import { TamamLogo } from "@/components/common/TamamLogo";

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
      <TamamLogo size="lg" />

      <Link prefetch={false}
        href="/projects"
        className="text-xs text-ink-2 hover:text-accent font-medium"
      >
        &larr; Continue without signing in
      </Link>

      {ssoError && !dismissedError && (
        <div role="alert" className="max-w-lg w-full p-3 rounded-md bg-danger-soft border border-danger/30 text-danger text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-danger mt-0.5" />
          <span className="flex-1">{ssoError}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissedError(true)}
            className="font-semibold text-danger"
          >
            ×
          </button>
        </div>
      )}

      <SignInCard
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
