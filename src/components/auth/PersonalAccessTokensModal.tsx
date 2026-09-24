"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "@/context/UserContext";
import { PersonalAccessToken } from "@/types";
import {
  getUserTokens,
  createPersonalAccessToken,
  revokePersonalAccessToken,
  deletePersonalAccessToken,
} from "@/lib/actions/tokens";
import { KeyRound, Plus, Trash2, Ban, Check, Copy, AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatDistanceToNow, format } from "date-fns";

interface PersonalAccessTokensModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = "list" | "create" | "created";

const EXPIRATION_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "1 year" },
  { value: 0, label: "Never" },
];

export default function PersonalAccessTokensModal({
  isOpen,
  onClose,
}: PersonalAccessTokensModalProps) {
  const { currentUser } = useCurrentUser();
  const [confirmAction, confirmDialog] = useConfirm();
  const { toast } = useToast();
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

  const userId = currentUser?.id;
  const loadTokens = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const list = await getUserTokens(userId);
      setTokens(list);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load tokens when modal opens
  useEffect(() => {
    if (!isOpen) return;
    loadTokens();
  }, [isOpen, loadTokens]);

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
    const ok = await confirmAction({
      title: `Revoke ${name}?`,
      description: "Anything using this token loses access straight away. The record stays, marked Revoked.",
      confirmLabel: "Revoke token",
    });
    if (!ok) return;

    const res = await revokePersonalAccessToken(tokenId, currentUser.id);
    if (res.success) {
      setTokens((prev) =>
        prev.map((t) => (t.id === tokenId ? { ...t, revokedAt: new Date() } : t))
      );
    } else {
      toast({ title: "The token couldn't be revoked.", tone: "danger" });
    }
  };

  const handleDelete = async (tokenId: string, name: string) => {
    if (!currentUser) return;
    const ok = await confirmAction({
      title: `Delete ${name}?`,
      description: "The token and its record are removed for good. Anything still using it loses access.",
      confirmLabel: "Delete token",
    });
    if (!ok) return;

    const res = await deletePersonalAccessToken(tokenId, currentUser.id);
    if (res.success) {
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    } else {
      toast({ title: "The token couldn't be deleted.", tone: "danger" });
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
      return { label: "Revoked", color: "bg-subtle text-ink-2" };
    }
    if (t.expiresAt && new Date(t.expiresAt) < new Date()) {
      return { label: "Expired", color: "bg-warning-soft text-warning border border-warning/30" };
    }
    return { label: "Active", color: "bg-success-soft text-success border border-success/30" };
  };

  const finishCreated = () => {
    setView("list");
    setNewlyCreatedToken(null);
    setNewlyCreatedData(null);
  };
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const curl = newlyCreatedToken ? `curl -H "Authorization: Bearer ${newlyCreatedToken}" ${origin}/api/v1/auth/verify` : "";

  const titles: Record<ModalView, string> = {
    list: "Personal access tokens",
    create: "New personal access token",
    created: "Copy your new token",
  };
  const footers: Record<ModalView, React.ReactNode> = {
    list: <Button onClick={onClose}>Close</Button>,
    create: (
      <>
        <Button onClick={() => setView("list")}>Back</Button>
        <Button type="submit" form="token-form" variant="primary" loading={isCreating}>
          Create token
        </Button>
      </>
    ),
    created: (
      <Button variant="primary" onClick={finishCreated}>
        I&apos;ve saved it
      </Button>
    ),
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {confirmDialog}
      <DialogContent
        size={view === "list" ? "xl" : "md"}
        title={titles[view]}
        description={view === "list" ? "Tokens let scripts, integrations and developer tools use the Trackr API as you." : undefined}
        footer={footers[view]}
      >
        {view === "list" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">
                Tokens act as <span className="font-medium text-ink">{currentUser?.name}</span> ({currentUser?.email}).
              </p>
              <Button variant="primary" onClick={() => setView("create")}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New token
              </Button>
            </div>

            {isLoading ? (
              <p className="flex items-center justify-center gap-2 py-12 text-xs text-muted">
                <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
                Loading tokens…
              </p>
            ) : tokens.length === 0 ? (
              <div className="rounded-card border border-dashed border-subtle px-4 py-12 text-center">
                <KeyRound className="mx-auto mb-2 h-8 w-8 text-muted" aria-hidden="true" />
                <p className="text-[13px] font-medium text-ink">No tokens yet</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted">Create one to use the Trackr API from your editor, CI or scripts.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-control border border-subtle">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-surface-sunk text-ink-2">
                    <tr>
                      <th scope="col" className="h-8 px-3 font-medium">Name</th>
                      <th scope="col" className="h-8 px-3 font-medium">Token</th>
                      <th scope="col" className="h-8 px-3 font-medium">Status</th>
                      <th scope="col" className="h-8 px-3 font-medium">Expires</th>
                      <th scope="col" className="h-8 px-3 font-medium">Last used</th>
                      <th scope="col" className="h-8 px-3 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle text-ink">
                    {tokens.map((token) => {
                      const status = getTokenStatus(token);
                      return (
                        <tr key={token.id}>
                          <td className="px-3 py-2">
                            <span className="font-medium">{token.name}</span>
                            <span className="block text-[11px] text-muted">Created {format(new Date(token.createdAt), "MMM d, yyyy")}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-ink-2">
                            {token.tokenPrefix}••••••••{token.lastFour}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${status.color}`}>{status.label}</span>
                          </td>
                          <td className="px-3 py-2 text-ink-2">{token.expiresAt ? format(new Date(token.expiresAt), "MMM d, yyyy") : "Never"}</td>
                          <td className="px-3 py-2 text-ink-2">
                            {token.lastUsedAt ? formatDistanceToNow(new Date(token.lastUsedAt), { addSuffix: true }) : "Never"}
                          </td>
                          <td className="px-3 py-2">
                            <span className="flex justify-end gap-1">
                              {!token.revokedAt && (
                                <IconButton
                                  label={`Revoke ${token.name}`}
                                  size="sm"
                                  icon={<Ban className="h-3.5 w-3.5" />}
                                  onClick={() => handleRevoke(token.id, token.name)}
                                />
                              )}
                              <IconButton
                                label={`Delete ${token.name}`}
                                size="sm"
                                icon={<Trash2 className="h-3.5 w-3.5" />}
                                onClick={() => handleDelete(token.id, token.name)}
                              />
                            </span>
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

        {view === "create" && (
          <form id="token-form" onSubmit={handleCreateSubmit} noValidate className="space-y-4">
            <p className="text-xs text-muted">A token works like a password for the API. You can give it an expiry date and revoke it at any time.</p>
            {createError && (
              <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-xs text-danger">
                {createError}
              </p>
            )}
            <Field label="Name" required hint="What it's for, so you can recognise it later.">
              <Input placeholder="GitHub Actions, VS Code, export script" value={tokenName} onChange={(e) => setTokenName(e.target.value)} autoFocus />
            </Field>
            <Field label="Expires after">
              <Select
                value={String(expirationDays)}
                onChange={(v) => setExpirationDays(parseInt(v, 10))}
                options={EXPIRATION_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
              />
            </Field>
            {expirationDays === 0 && (
              <p className="flex items-start gap-2 rounded-control bg-warning-soft px-3 py-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                A token that never expires stays dangerous if it leaks. An expiry date is safer.
              </p>
            )}
          </form>
        )}

        {view === "created" && newlyCreatedToken && (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-control bg-warning-soft px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Copy the token now. You won&apos;t be able to see it again.
            </p>
            <Field label={`Token: ${newlyCreatedData?.name ?? ""}`}>
              <div className="flex gap-2">
                <Input readOnly value={newlyCreatedToken} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button variant="primary" onClick={() => copyToClipboard(newlyCreatedToken)}>
                  {hasCopied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                  {hasCopied ? "Copied" : "Copy"}
                </Button>
              </div>
            </Field>
            <p className="text-xs text-ink-2">
              Expires:{" "}
              <span className="font-medium text-ink">
                {newlyCreatedData?.expiresAt ? format(new Date(newlyCreatedData.expiresAt), "MMMM d, yyyy") : "never"}
              </span>
            </p>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-ink-2">Try it with curl</p>
              <div className="relative overflow-x-auto rounded-control bg-surface-sunk p-3 font-mono text-[11px] text-ink">
                <pre className="pr-20">{curl}</pre>
                <Button size="sm" className="absolute right-2 top-2" onClick={() => copyToClipboard(curl, true)}>
                  {hasCopiedCurl ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
