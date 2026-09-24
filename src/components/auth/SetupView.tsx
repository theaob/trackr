"use client";

import React, { useState } from "react";
import { completeSetup } from "@/lib/actions/setup";
import { TamamLogo } from "@/components/common/TamamLogo";
import {
  ShieldCheck,
  User as UserIcon,
  Mail,
  Lock,
  FolderPlus,
  Loader2,
  AlertCircle,
  Rocket,
} from "lucide-react";

export default function SetupView() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProjectNameChange = (val: string) => {
    setProjectName(val);
    if (!keyManuallyEdited) {
      setProjectKey(
        val
          .trim()
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(0, 6)
          .toUpperCase()
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await completeSetup({ name, email, password, projectName, projectKey });
      if (res.success) {
        // Full navigation, not router.push: the session cookie this action just
        // set needs a fresh request to be picked up everywhere (root layout,
        // UserContext), and a client-side transition can race with that.
        window.location.assign(`/projects/${res.project.key}/board`);
      } else {
        setError(res.error || "Setup could not be completed.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-surface-sunk flex flex-col items-center justify-center gap-6 p-4">
      <TamamLogo size="lg" />

      <div className="bg-surface w-full max-w-lg rounded-xl shadow-2xl border border-subtle overflow-hidden flex flex-col">
        <div className="bg-ink text-surface px-6 py-5 flex items-center gap-3 border-b border-ink/80">
          <div className="w-9 h-9 rounded-lg bg-accent/30 border border-accent flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-surface" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Welcome to Tamam</h1>
            <p className="text-xs text-surface/75">
              This instance has no accounts yet. Create the admin account to get started.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm">
          {error && (
            <div className="p-3 rounded-md bg-danger-soft border border-danger/30 text-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-xs font-bold text-ink-2 uppercase tracking-wider">
              Admin account
            </h2>

            <div>
              <label htmlFor="setup-name" className="block text-xs font-semibold text-ink mb-1">Full name</label>
              <div className="relative">
                <UserIcon aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  required
                  autoFocus
                  id="setup-name"
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-subtle rounded-md focus:border-accent text-ink"
                />
              </div>
            </div>

            <div>
              <label htmlFor="setup-email" className="block text-xs font-semibold text-ink mb-1">Email address</label>
              <div className="relative">
                <Mail aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  required
                  id="setup-email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-subtle rounded-md focus:border-accent text-ink"
                />
              </div>
            </div>

            <div>
              <label htmlFor="setup-password" className="block text-xs font-semibold text-ink mb-1">Password</label>
              <div className="relative">
                <Lock aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  required
                  minLength={8}
                  id="setup-password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-subtle rounded-md focus:border-accent text-ink"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-1 border-t border-subtle">
            <h2 className="text-xs font-bold text-ink-2 uppercase tracking-wider pt-4">
              First project
            </h2>

            <div>
              <label htmlFor="setup-project-name" className="block text-xs font-semibold text-ink mb-1">Project name</label>
              <div className="relative">
                <FolderPlus aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  required
                  id="setup-project-name"
                  placeholder="e.g. Falcon AI Engine"
                  value={projectName}
                  onChange={(e) => handleProjectNameChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-subtle rounded-md focus:border-accent text-ink"
                />
              </div>
            </div>

            <div>
              <label htmlFor="setup-project-key" className="block text-xs font-semibold text-ink mb-1">Project key</label>
              <input
                type="text"
                required
                maxLength={10}
                id="setup-project-key"
                  placeholder="e.g. FALCON"
                value={projectKey}
                onChange={(e) => {
                  setKeyManuallyEdited(true);
                  setProjectKey(e.target.value.toUpperCase());
                }}
                aria-describedby="setup-project-key-hint"
                className="w-full px-3 py-2 text-xs border border-subtle rounded-md focus:border-accent font-mono uppercase text-ink"
              />
              <p id="setup-project-key-hint" className="text-[11px] text-muted mt-1">
                Prefix used for issues in this project (e.g. {projectKey || "KEY"}-1).
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-accent-fg text-xs font-bold rounded-md flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            <span>Complete setup</span>
          </button>
        </form>
      </div>
    </div>
  );
}
