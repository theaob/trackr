"use client";

import React, { useState } from "react";
import { completeSetup } from "@/lib/actions/setup";
import { TrackrLogo } from "@/components/common/TrackrLogo";
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
    <div className="min-h-screen w-full bg-jira-gray-100 flex flex-col items-center justify-center gap-6 p-4">
      <TrackrLogo size="lg" />

      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-jira-gray-300 overflow-hidden flex flex-col">
        <div className="bg-jira-navy text-white px-6 py-5 flex items-center gap-3 border-b border-jira-navy/80">
          <div className="w-9 h-9 rounded-lg bg-jira-blue/30 border border-jira-blue flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-jira-blue-light" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Welcome to Trackr</h2>
            <p className="text-xs text-jira-gray-400">
              This instance has no accounts yet. Create the admin account to get started.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm">
          {error && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-jira-gray-700 uppercase tracking-wider">
              Admin account
            </h3>

            <div>
              <label className="block text-xs font-semibold text-jira-navy mb-1">Full name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-500" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-jira-navy mb-1">Email address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-500" />
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-jira-navy mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-500" />
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-1 border-t border-jira-gray-200">
            <h3 className="text-xs font-bold text-jira-gray-700 uppercase tracking-wider pt-4">
              First project
            </h3>

            <div>
              <label className="block text-xs font-semibold text-jira-navy mb-1">Project name</label>
              <div className="relative">
                <FolderPlus className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jira-gray-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Falcon AI Engine"
                  value={projectName}
                  onChange={(e) => handleProjectNameChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none text-jira-navy"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-jira-navy mb-1">Project key</label>
              <input
                type="text"
                required
                maxLength={10}
                placeholder="e.g. FALCON"
                value={projectKey}
                onChange={(e) => {
                  setKeyManuallyEdited(true);
                  setProjectKey(e.target.value.toUpperCase());
                }}
                className="w-full px-3 py-2 text-xs border border-jira-gray-300 rounded-md focus:border-jira-blue outline-none font-mono uppercase text-jira-navy"
              />
              <p className="text-[11px] text-jira-gray-500 mt-1">
                Prefix used for issues in this project (e.g. {projectKey || "KEY"}-1).
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-bold rounded-md flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            <span>Complete setup</span>
          </button>
        </form>
      </div>
    </div>
  );
}
