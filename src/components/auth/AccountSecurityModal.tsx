"use client";

import React, { useState } from "react";
import { CheckCircle2, Loader2, LogOut, ShieldCheck, X } from "lucide-react";
import { changePassword, signOutOtherSessions } from "@/lib/actions/auth";

interface AccountSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const INPUT =
  "w-full px-3 py-2 text-sm border border-subtle rounded focus:border-accent text-ink";

/** Change your password, or end your sessions on other devices. */
export default function AccountSecurityModal({ isOpen, onClose }: AccountSecurityModalProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const [signingOut, setSigningOut] = useState(false);
  const [signOutResult, setSignOutResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const close = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setPasswordError(null);
    setPasswordChanged(false);
    setSignOutResult(null);
    onClose();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordChanged(false);
    if (next !== confirm) {
      setPasswordError("The new passwords don't match.");
      return;
    }
    setSaving(true);
    const res = await changePassword(current, next);
    setSaving(false);
    if (res.success) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setPasswordChanged(true);
    } else {
      setPasswordError(res.error || "Couldn't change your password.");
    }
  };

  const handleSignOutOthers = async () => {
    setSigningOut(true);
    const res = await signOutOtherSessions();
    setSigningOut(false);
    setSignOutResult(
      res.success ? "Signed out everywhere else. This browser stays signed in." : res.error || "Something went wrong."
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={close}
    >
      <div
        className="bg-white rounded-lg shadow-2xl border border-subtle w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="account-security-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-accent-soft/70 flex items-center justify-center text-accent">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 id="account-security-title" className="text-base font-bold text-ink">
                Password &amp; sessions
              </h2>
              <p className="text-xs text-muted">Keep your account in your hands.</p>
            </div>
          </div>
          <button
            onClick={close}
            className="text-muted hover:text-ink p-1.5 rounded hover:bg-surface-sunk transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <form onSubmit={handleChangePassword} className="space-y-3">
            <h3 className="text-sm font-bold text-ink">Change password</h3>
            <p className="text-xs text-muted">
              Changing your password signs you out on every other device.
            </p>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Current password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={INPUT}
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="New password (at least 8 characters)"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={INPUT}
              minLength={8}
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Repeat new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={INPUT}
              required
            />
            {passwordError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2.5 py-1.5">
                {passwordError}
              </p>
            )}
            {passwordChanged && (
              <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Password changed. Other devices have been signed out.
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold rounded disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Change password
            </button>
          </form>

          <div className="pt-5 border-t border-subtle space-y-2">
            <h3 className="text-sm font-bold text-ink">Other sessions</h3>
            <p className="text-xs text-muted">
              Signed in somewhere you shouldn&apos;t be, or on a shared computer? End every session except this one.
            </p>
            <button
              type="button"
              onClick={handleSignOutOthers}
              disabled={signingOut}
              className="px-3 py-2 text-xs font-semibold text-ink border border-subtle rounded hover:bg-surface-sunk disabled:opacity-50 flex items-center gap-1.5"
            >
              {signingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              Sign out everywhere else
            </button>
            {signOutResult && <p className="text-xs text-ink-2">{signOutResult}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
