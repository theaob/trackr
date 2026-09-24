"use client";

import React, { useState } from "react";
import { CheckCircle2, LogOut } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { changePassword, signOutOtherSessions } from "@/lib/actions/auth";

interface AccountSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent title="Password and sessions" footer={<Button onClick={close}>Done</Button>}>
        <div className="space-y-6">
          <form onSubmit={handleChangePassword} className="space-y-3" aria-labelledby="change-password-heading">
            <div>
              <h3 id="change-password-heading" className="text-[13px] font-semibold text-ink">
                Change password
              </h3>
              <p className="text-xs text-muted">Changing your password signs you out on every other device.</p>
            </div>
            <Field label="Current password">
              <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </Field>
            <Field label="New password" hint="At least 8 characters.">
              <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
            </Field>
            <Field label="Repeat new password" error={passwordError}>
              <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </Field>
            {passwordChanged && (
              <p role="status" className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Password changed. Other devices have been signed out.
              </p>
            )}
            <Button type="submit" variant="primary" loading={saving}>
              Change password
            </Button>
          </form>

          <section aria-labelledby="sessions-heading" className="space-y-2 border-t border-subtle pt-5">
            <h3 id="sessions-heading" className="text-[13px] font-semibold text-ink">
              Other sessions
            </h3>
            <p className="text-xs text-muted">
              Signed in somewhere you shouldn&apos;t be, or on a shared computer? End every session except this one.
            </p>
            <Button onClick={handleSignOutOthers} loading={signingOut}>
              {!signingOut && <LogOut className="h-3.5 w-3.5" aria-hidden="true" />}
              Sign out everywhere else
            </Button>
            {signOutResult && (
              <p role="status" className="text-xs text-ink-2">
                {signOutResult}
              </p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
