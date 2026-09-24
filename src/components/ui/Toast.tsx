"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "./cn";

export type ToastTone = "info" | "success" | "danger";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before it goes; 0 keeps it until dismissed. */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, "description">> {
  id: number;
  description?: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Shows short confirmations ("Saved") and failures. Needs a <ToastProvider> above it. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

const ICONS: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  danger: AlertTriangle,
};

const ICON_COLORS: Record<ToastTone, string> = {
  info: "text-accent",
  success: "text-success",
  danger: "text-danger",
};

const DEFAULT_DURATION = 5000;
const MAX_VISIBLE = 3;

/**
 * Keeps the list of toasts and renders them in a live region, so screen
 * readers announce each one without moving focus. Failures are announced
 * assertively; everything else politely.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    const item: ToastItem = {
      id,
      title: options.title,
      description: options.description,
      tone: options.tone ?? "info",
      duration: options.duration ?? DEFAULT_DURATION,
    };
    setToasts((current) => [...current, item].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  const polite = toasts.filter((t) => t.tone !== "danger");
  const assertive = toasts.filter((t) => t.tone === "danger");

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 sm:items-end">
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-2 sm:items-end">
          {polite.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
        <div role="alert" aria-live="assertive" className="flex flex-col items-center gap-2 sm:items-end">
          {assertive.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const Icon = ICONS[toast.tone];

  useEffect(() => {
    if (!toast.duration || paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, paused, onDismiss]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        "pointer-events-auto flex w-[min(360px,calc(100vw-2rem))] items-start gap-2.5 rounded-card border border-subtle bg-surface p-3 text-ink shadow-overlay",
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-150"
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ICON_COLORS[toast.tone])} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 text-xs text-ink-2">{toast.description}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="-m-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-sunk hover:text-ink"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
