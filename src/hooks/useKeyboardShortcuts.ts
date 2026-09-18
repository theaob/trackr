"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export function isInputElement(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  if (typeof el.tagName !== "string") return false;
  const tagName = el.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
  if (el.isContentEditable === true) return true;
  return false;
}

export interface KeyboardShortcutHandlers {
  onCreateIssue?: () => void;
  onToggleSidebar?: () => void;
  onOpenHelp?: () => void;
  onFocusSearch?: () => void;
  onCloseModal?: () => void;
  onNavigate?: (destination: "board" | "backlog" | "issues" | "roadmap" | "releases" | "reports" | "settings" | "projects") => void;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  handlers: KeyboardShortcutHandlers;
}

export function useKeyboardShortcuts({ enabled = true, handlers }: UseKeyboardShortcutsOptions) {
  const [activeSequence, setActiveSequence] = useState<string | null>(null);
  const sequenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const clearSequence = useCallback(() => {
    if (sequenceTimerRef.current) {
      clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
    setActiveSequence(null);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if modified with Ctrl/Meta/Alt (unless it's a specific combination)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const inInput = isInputElement(e.target);

      // Escape handles closing or blurring
      if (e.key === "Escape") {
        if (inInput && e.target instanceof HTMLElement) {
          e.target.blur();
        }
        clearSequence();
        handlersRef.current.onCloseModal?.();
        return;
      }

      // If user is typing in an input, ignore all letter/single-key shortcuts
      if (inInput) {
        return;
      }

      const key = e.key;

      // Check if we are currently in a "g" sequence
      if (sequenceTimerRef.current) {
        clearSequence();
        const lowerKey = key.toLowerCase();

        switch (lowerKey) {
          case "d":
            e.preventDefault();
            handlersRef.current.onNavigate?.("board");
            return;
          case "b":
            e.preventDefault();
            handlersRef.current.onNavigate?.("backlog");
            return;
          case "i":
            e.preventDefault();
            handlersRef.current.onNavigate?.("issues");
            return;
          case "r":
            e.preventDefault();
            handlersRef.current.onNavigate?.("roadmap");
            return;
          case "l":
            e.preventDefault();
            handlersRef.current.onNavigate?.("releases");
            return;
          case "e":
            e.preventDefault();
            handlersRef.current.onNavigate?.("reports");
            return;
          case "s":
            e.preventDefault();
            handlersRef.current.onNavigate?.("settings");
            return;
          case "p":
            e.preventDefault();
            handlersRef.current.onNavigate?.("projects");
            return;
          default:
            // Any other key cancels the sequence and gets processed normally if matching
            break;
        }
      }

      // Start "g" sequence
      if (key.toLowerCase() === "g") {
        e.preventDefault();
        setActiveSequence("g");
        sequenceTimerRef.current = setTimeout(() => {
          clearSequence();
        }, 1500);
        return;
      }

      // Single-key global shortcuts
      if (key === "c" || key === "C") {
        e.preventDefault();
        handlersRef.current.onCreateIssue?.();
        return;
      }

      if (key === "/") {
        e.preventDefault();
        handlersRef.current.onFocusSearch?.();
        return;
      }

      if (key === "?" || (key === "/" && e.shiftKey)) {
        e.preventDefault();
        handlersRef.current.onOpenHelp?.();
        return;
      }

      if (key === "[") {
        e.preventDefault();
        handlersRef.current.onToggleSidebar?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (sequenceTimerRef.current) {
        clearTimeout(sequenceTimerRef.current);
      }
    };
  }, [enabled, clearSequence]);

  return {
    activeSequence,
    clearSequence,
  };
}
