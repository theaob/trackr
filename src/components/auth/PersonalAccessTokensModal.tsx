"use client";

import React, { useState, useEffect } from "react";
import { useCurrentUser } from "@/context/UserContext";
import { PersonalAccessToken } from "@/types";
import {
  getUserTokens,
  createPersonalAccessToken,
  revokePersonalAccessToken,
  deletePersonalAccessToken,
} from "@/lib/actions/tokens";
import {
  KeyRound,
  Plus,
  Trash2,
  Ban,
  Check,
  Copy,
  AlertTriangle,
  X,
  ShieldCheck,
  Calendar,
  Clock,
  Terminal,
  Loader2,
  ArrowLeft,
  Info,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface PersonalAccessTokensModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = "list" | "create" | "created";

const EXPIRATION_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days (Recommended)" },
  { value: 180, label: "180 days" },
  { value: 365, label: "1 year" },
  { value: 0, label: "No expiration (Never)" },
];

export default function PersonalAccessTokensModal({
  isOpen,
  onClose,
}: PersonalAccessTokensModalProps) {
  const { currentUser } = useCurrentUser();
  const [view, setView] = useState<ModalView>("list");
  const [tokens, setTokens] = useState<PersonalAccessToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Creation State
  const [tokenName, setTokenName] = useState("");
  const [expirationDays, setExpirationDays] = useState<number>(90);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Success State
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [newlyCreatedData, setNewlyCreatedData] = useState<PersonalAccessToken | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasCopiedCurl, setHasCopiedCurl] = useState(false);

  // Load tokens when modal opens
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    loadTokens();
  }, [isOpen, currentUser]);

  const loadTokens = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const list = await getUserTokens(currentUser.id);
      setTokens(list);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!tokenName.trim()) {
      setCreateError("Please provide a token name");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await createPersonalAccessToken({
        userId: currentUser.id,
        name: tokenName.trim(),
        expirationDays: expirationDays === 0 ? null : expirationDays,
      });

      if (res.success && res.token && res.tokenData) {
        setNewlyCreatedToken(res.token);
        setNewlyCreatedData(res.tokenData);
        setTokens((prev) => [res.tokenData!, ...prev]);
        setView("created");
        setTokenName("");
        setExpirationDays(90);
      } else {
        setCreateError(res.error || "Failed to generate token");
      }
    } catch (err: any) {
      setCreateError(err.message || "An unexpected error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (tokenId: string, name: string) => {
    if (!currentUser) return;
    if (!confirm(`Are you sure you want to revoke the token "${name}"? Any applications using this token will lose access immediately.`)) {
      return;
    }

    const res = await revokePersonalAccessToken(tokenId, currentUser.id);
    if (res.success) {
      setTokens((prev) =>
        prev.map((t) => (t.id === tokenId ? { ...t, revokedAt: new Date() } : t))
      );
    } else {
      alert("Failed to revoke token.");
    }
  };

  const handleDelete = async (tokenId: string, name: string) => {
    if (!currentUser) return;
    if (!confirm(`Permanently delete record for token "${name}"?`)) {
      return;
    }

    const res = await deletePersonalAccessToken(tokenId, currentUser.id);
    if (res.success) {
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    } else {
      alert("Failed to delete token.");
    }
  };

  const copyToClipboard = (text: string, isCurl = false) => {
    navigator.clipboard.writeText(text);
    if (isCurl) {
      setHasCopiedCurl(true);
      setTimeout(() => setHasCopiedCurl(false), 2500);
    } else {
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2500);
    }
  };

  const getTokenStatus = (t: PersonalAccessToken) => {
    if (t.revokedAt) {
      return { label: "Revoked", color: "bg-jira-gray-200 text-jira-gray-700" };
    }
    if (t.expiresAt && new Date(t.expiresAt) < new Date()) {
      return { label: "Expired", color: "bg-amber-100 text-amber-800 border border-amber-300" };
    }
    return { label: "Active", color: "bg-emerald-100 text-emerald-800 border border-emerald-300" };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-lg shadow-2xl border border-jira-gray-300 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-jira-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-jira-blue-light/70 flex items-center justify-center text-jira-blue">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-jira-navy">Personal Access Tokens</h2>
              <p className="text-xs text-jira-gray-500">
                Manage API authentication tokens for scripts, integrations, and developer tools.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-jira-gray-400 hover:text-jira-navy p-1.5 rounded hover:bg-jira-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* VIEW 1: TOKEN LIST */}
          {view === "list" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-jira-navy">Active Tokens</h3>
                  <p className="text-xs text-jira-gray-500">
                    Tokens authenticate as <span className="font-semibold text-jira-navy">{currentUser?.name}</span> ({currentUser?.email})
                  </p>
                </div>
                <button
                  onClick={() => setView("create")}
                  className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-3 py-2 rounded flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Generate new token
                </button>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-jira-gray-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-jira-blue" />
                  <span>Loading tokens...</span>
                </div>
              ) : tokens.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-jira-gray-300 rounded-lg bg-jira-gray-50/70">
                  <KeyRound className="w-8 h-8 text-jira-gray-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-jira-navy">No personal access tokens</h4>
                  <p className="text-xs text-jira-gray-500 max-w-sm mx-auto mt-1 mb-4">
                    Generate a token to interact with the Jira clone API from your IDE, CI/CD pipeline, or scripts.
                  </p>
                  <button
                    onClick={() => setView("create")}
                    className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-4 py-2 rounded inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create Your First Token
                  </button>
                </div>
              ) : (
                <div className="border border-jira-gray-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                  <table className="min-w-full divide-y divide-jira-gray-200 text-left text-xs">
                    <thead className="bg-jira-gray-50 font-semibold text-jira-gray-600">
                      <tr>
                        <th className="px-4 py-3">Token Name</th>
                        <th className="px-4 py-3">Token Identifier</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Expires</th>
                        <th className="px-4 py-3">Last Used</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-jira-gray-200 text-jira-navy">
                      {tokens.map((token) => {
                        const status = getTokenStatus(token);
                        return (
                          <tr key={token.id} className="hover:bg-jira-gray-50/70 transition-colors">
                            <td className="px-4 py-3 font-semibold text-jira-navy">
                              {token.name}
                              <div className="text-[10px] text-jira-gray-400 font-normal">
                                Created {format(new Date(token.createdAt), "MMM d, yyyy")}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-jira-gray-600 text-[11px]">
                              {token.tokenPrefix}••••••••{token.lastFour}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.color}`}
                              >
                                {status.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-jira-gray-600">
                              {token.expiresAt ? (
                                <span>{format(new Date(token.expiresAt), "MMM d, yyyy")}</span>
                              ) : (
                                <span className="text-jira-gray-400 italic">Never</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-jira-gray-600">
                              {token.lastUsedAt ? (
                                formatDistanceToNow(new Date(token.lastUsedAt), { addSuffix: true })
                              ) : (
                                <span className="text-jira-gray-400 italic">Never used</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {!token.revokedAt && (
                                  <button
                                    onClick={() => handleRevoke(token.id, token.name)}
                                    title="Revoke Token"
                                    className="p-1 rounded text-jira-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDelete(token.id, token.name)}
                                  title="Delete Record"
                                  className="p-1 rounded text-jira-gray-400 hover:text-jira-red hover:bg-jira-red/10 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: CREATE TOKEN FORM */}
          {view === "create" && (
            <form onSubmit={handleCreateSubmit} className="space-y-4 max-w-xl mx-auto">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="text-xs text-jira-gray-500 hover:text-jira-navy flex items-center gap-1 font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to token list
                </button>
              </div>

              <div>
                <h3 className="text-base font-bold text-jira-navy">Generate Personal Access Token</h3>
                <p className="text-xs text-jira-gray-500 mt-0.5">
                  Personal access tokens function like ordinary passwords, but can be customized with expiration dates and revoked at any time.
                </p>
              </div>

              {createError && (
                <div className="p-3 bg-jira-red/10 border border-jira-red/30 rounded text-xs text-jira-red font-medium">
                  {createError}
                </div>
              )}

              {/* Token Name */}
              <div>
                <label className="block text-xs font-semibold text-jira-gray-700 mb-1">
                  Token Name <span className="text-jira-red">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. GitHub Actions CI, VS Code Jira, Data Export Script"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-jira-gray-500 mt-1">
                  What is this token for? Choose a name that helps you identify its purpose later.
                </p>
              </div>

              {/* Expiration Options */}
              <div>
                <label className="block text-xs font-semibold text-jira-gray-700 mb-1">
                  Expiration
                </label>
                <select
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(parseInt(e.target.value, 10))}
                  className="w-full text-xs px-3 py-2 bg-white border border-jira-gray-300 rounded focus:border-jira-blue outline-none"
                >
                  {EXPIRATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {expirationDays === 0 && (
                  <div className="mt-2 flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Tokens with no expiration date present a security risk if exposed or leaked. We recommend setting an expiration date.
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-jira-gray-200">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="text-xs font-medium px-4 py-2 rounded text-jira-gray-700 hover:bg-jira-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="text-xs font-semibold px-4 py-2 rounded bg-jira-blue text-white hover:bg-jira-blue-hover disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Generate Token
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: TOKEN CREATED SUCCESS SCREEN */}
          {view === "created" && newlyCreatedToken && (
            <div className="space-y-5 max-w-xl mx-auto">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-300 rounded-md text-amber-900 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold">Important:</span> Make sure to copy your personal access token now. You won’t be able to see it again!
                </div>
              </div>

              {/* Raw Token Box */}
              <div>
                <label className="block text-xs font-bold text-jira-gray-700 uppercase tracking-wider mb-1.5">
                  Your New Personal Access Token
                </label>
                <div className="flex items-center gap-2 bg-jira-gray-50 border border-jira-gray-300 rounded-md p-2">
                  <input
                    type="text"
                    readOnly
                    value={newlyCreatedToken}
                    className="w-full bg-transparent font-mono text-xs text-jira-navy font-semibold select-all outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(newlyCreatedToken)}
                    className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs"
                  >
                    {hasCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Token Summary info */}
              <div className="bg-jira-gray-50/70 border border-jira-gray-200 rounded-md p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-jira-gray-500">Token Name:</span>
                  <span className="font-semibold text-jira-navy">{newlyCreatedData?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-jira-gray-500">Expires:</span>
                  <span className="font-semibold text-jira-navy">
                    {newlyCreatedData?.expiresAt
                      ? format(new Date(newlyCreatedData.expiresAt), "MMMM d, yyyy")
                      : "Never"}
                  </span>
                </div>
              </div>

              {/* Quickstart API example */}
              <div>
                <label className="block text-xs font-semibold text-jira-gray-700 mb-1 flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5 text-jira-blue" />
                  <span>How to use in API requests (cURL):</span>
                </label>
                <div className="relative bg-jira-navy text-jira-gray-100 p-3 rounded-md font-mono text-[11px] overflow-x-auto">
                  <pre className="pr-16">{`curl -H "Authorization: Bearer ${newlyCreatedToken}" \\\n  http://localhost:3000/api/v1/auth/verify`}</pre>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `curl -H "Authorization: Bearer ${newlyCreatedToken}" http://localhost:3000/api/v1/auth/verify`,
                        true
                      )
                    }
                    className="absolute top-2.5 right-2.5 bg-jira-gray-800 hover:bg-jira-gray-700 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1 transition-colors"
                  >
                    {hasCopiedCurl ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{hasCopiedCurl ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Done button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setView("list");
                    setNewlyCreatedToken(null);
                    setNewlyCreatedData(null);
                  }}
                  className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-4 py-2 rounded transition-colors shadow-2xs"
                >
                  Done (I have saved my token)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
