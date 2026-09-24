"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useKeyboardShortcuts, type NavigateDestination } from "@/hooks/useKeyboardShortcuts";
import KeyboardShortcutsModal from "@/components/common/KeyboardShortcutsModal";
import SpotlightSearch from "@/components/common/SpotlightSearch";
import { useCurrentUser } from "@/context/UserContext";

interface KeyboardShortcutsContextType {
  isShortcutsModalOpen: boolean;
  openShortcutsModal: () => void;
  closeShortcutsModal: () => void;
  registerCreateIssue: (fn: () => void) => () => void;
  registerToggleSidebar: (fn: () => void) => () => void;
  openSpotlight: () => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType>({
  isShortcutsModalOpen: false,
  openShortcutsModal: () => {},
  closeShortcutsModal: () => {},
  registerCreateIssue: () => () => {},
  registerToggleSidebar: () => () => {},
  openSpotlight: () => {},
});

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentUserHasNewLayout = !!useCurrentUser().currentUser?.useNewLayout;
  const pathname = usePathname();
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  const createIssueHandlerRef = useRef<(() => void) | null>(null);
  const toggleSidebarHandlerRef = useRef<(() => void) | null>(null);

  const registerCreateIssue = useCallback((fn: () => void) => {
    createIssueHandlerRef.current = fn;
    return () => {
      createIssueHandlerRef.current = null;
    };
  }, []);

  const registerToggleSidebar = useCallback((fn: () => void) => {
    toggleSidebarHandlerRef.current = fn;
    return () => {
      toggleSidebarHandlerRef.current = null;
    };
  }, []);

  const openShortcutsModal = useCallback(() => setIsShortcutsModalOpen(true), []);
  const closeShortcutsModal = useCallback(() => setIsShortcutsModalOpen(false), []);

  // The ⌘K panel. There's nothing to search before signing in or during setup.
  const [spotlight, setSpotlight] = useState<{ canCreateIssue: boolean } | null>(null);
  const spotlightAvailable = !pathname?.startsWith("/login") && !pathname?.startsWith("/setup");
  const openSpotlight = useCallback(() => {
    if (!spotlightAvailable) return;
    setIsShortcutsModalOpen(false);
    setSpotlight({ canCreateIssue: !!createIssueHandlerRef.current });
  }, [spotlightAvailable]);
  const closeSpotlight = useCallback(() => setSpotlight(null), []);
  const createIssueFromSpotlight = useCallback(() => createIssueHandlerRef.current?.(), []);

  // Extract current project key from pathname if present
  const projectKey = React.useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/^\/projects\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  const handleNavigate = useCallback(
    (dest: NavigateDestination) => {
      if (dest === "projects" || dest === "home" || dest === "inbox") {
        // Home and Inbox belong to the new layout; on the classic one they
        // redirect to Projects.
        router.push(`/${dest}`);
        return;
      }
      if (projectKey) {
        router.push(`/projects/${projectKey}/${dest}`);
      } else {
        router.push("/projects");
      }
    },
    [router, projectKey]
  );

  // "/" focuses the page's filter box where there is one, and opens search elsewhere.
  const handleFocusSearch = useCallback(() => {
    const input = document.getElementById("global-search-input") as HTMLInputElement | null;
    if (input && input.offsetParent !== null) {
      input.focus();
      input.select();
    } else {
      openSpotlight();
    }
  }, [openSpotlight]);

  const { activeSequence } = useKeyboardShortcuts({
    handlers: {
      onCreateIssue: () => createIssueHandlerRef.current?.(),
      onToggleSidebar: () => toggleSidebarHandlerRef.current?.(),
      onOpenHelp: openShortcutsModal,
      onFocusSearch: handleFocusSearch,
      onOpenSpotlight: openSpotlight,
      onCloseModal: closeShortcutsModal,
      onNavigate: handleNavigate,
    },
  });

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        isShortcutsModalOpen,
        openShortcutsModal,
        closeShortcutsModal,
        registerCreateIssue,
        registerToggleSidebar,
        openSpotlight,
      }}
    >
      {children}

      {/* Floating sequence helper pill when 'g' is pressed */}
      {activeSequence === "g" && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-jira-navy text-white text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 select-none border border-jira-gray-700 pointer-events-none"
        >
          <span className="font-bold text-jira-blue-light">Go to...</span>
          <span className="text-jira-gray-200">
            <kbd className="font-mono font-bold bg-white/10 px-1 py-0.5 rounded">b</kbd> Backlog ·{" "}
            <kbd className="font-mono font-bold bg-white/10 px-1 py-0.5 rounded">d</kbd> Board ·{" "}
            <kbd className="font-mono font-bold bg-white/10 px-1 py-0.5 rounded">i</kbd> Issues ·{" "}
            <kbd className="font-mono font-bold bg-white/10 px-1 py-0.5 rounded">r</kbd> Roadmap ·{" "}
            <kbd className="font-mono font-bold bg-white/10 px-1 py-0.5 rounded">l</kbd> Releases ·{" "}
            <kbd className="font-mono font-bold bg-white/10 px-1 py-0.5 rounded">e</kbd> Reports ·{" "}
            <kbd className="font-mono font-bold bg-white/10 px-1 py-0.5 rounded">s</kbd> Settings ·{" "}
            <kbd className="font-mono font-bold bg-white/10 px-1 py-0.5 rounded">p</kbd> Projects
            {currentUserHasNewLayout && (
              <>
                {" "}·{" "}
                <kbd className="font-mono font-bold bg-white/10 px-1 py-0.5 rounded">h</kbd> Home ·{" "}
                <kbd className="font-mono font-bold bg-white/10 px-1 py-0.5 rounded">n</kbd> Inbox
              </>
            )}
          </span>
        </div>
      )}

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <KeyboardShortcutsModal isOpen={isShortcutsModalOpen} onClose={closeShortcutsModal} />

      {spotlight && (
        <SpotlightSearch
          onClose={closeSpotlight}
          onCreateIssue={spotlight.canCreateIssue ? createIssueFromSpotlight : undefined}
          onShowShortcuts={openShortcutsModal}
        />
      )}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcutsContext() {
  return useContext(KeyboardShortcutsContext);
}
