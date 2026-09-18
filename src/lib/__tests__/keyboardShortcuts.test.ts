import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isInputElement } from "@/hooks/useKeyboardShortcuts";

describe("isInputElement", () => {
  it("returns false for null or non-elements", () => {
    expect(isInputElement(null)).toBe(false);
    expect(isInputElement({} as any)).toBe(false);
  });

  it("returns false for standard non-input elements", () => {
    expect(isInputElement({ tagName: "DIV" } as any)).toBe(false);
    expect(isInputElement({ tagName: "BUTTON" } as any)).toBe(false);
    expect(isInputElement({ tagName: "SPAN" } as any)).toBe(false);
    expect(isInputElement({ tagName: "A" } as any)).toBe(false);
  });

  it("returns true for input, textarea, and select elements", () => {
    expect(isInputElement({ tagName: "INPUT" } as any)).toBe(true);
    expect(isInputElement({ tagName: "input" } as any)).toBe(true);
    expect(isInputElement({ tagName: "TEXTAREA" } as any)).toBe(true);
    expect(isInputElement({ tagName: "textarea" } as any)).toBe(true);
    expect(isInputElement({ tagName: "SELECT" } as any)).toBe(true);
    expect(isInputElement({ tagName: "select" } as any)).toBe(true);
  });

  it("returns true for contenteditable elements", () => {
    expect(isInputElement({ tagName: "DIV", isContentEditable: true } as any)).toBe(true);
    expect(isInputElement({ tagName: "P", isContentEditable: true } as any)).toBe(true);
    expect(isInputElement({ tagName: "DIV", isContentEditable: false } as any)).toBe(false);
  });
});

describe("keyboard shortcuts dispatch simulation", () => {
  // Simulate keyboard shortcut handling logic
  function createShortcutDispatcher(handlers: {
    onCreateIssue?: () => void;
    onToggleSidebar?: () => void;
    onOpenHelp?: () => void;
    onFocusSearch?: () => void;
    onCloseModal?: () => void;
    onNavigate?: (dest: string) => void;
  }) {
    let pendingSequence: string | null = null;
    let timer: any = null;

    const clearSequence = () => {
      pendingSequence = null;
      if (timer) clearTimeout(timer);
      timer = null;
    };

    const dispatch = (e: {
      key: string;
      metaKey?: boolean;
      ctrlKey?: boolean;
      altKey?: boolean;
      shiftKey?: boolean;
      target?: any;
      preventDefault?: () => void;
    }) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const inInput = isInputElement(e.target);

      if (e.key === "Escape") {
        clearSequence();
        handlers.onCloseModal?.();
        return;
      }

      if (inInput) return;

      if (pendingSequence === "g") {
        clearSequence();
        const lower = e.key.toLowerCase();
        const validDests = ["board", "backlog", "issues", "roadmap", "releases", "reports", "settings", "projects"];
        const destMap: Record<string, string> = {
          d: "board",
          b: "backlog",
          i: "issues",
          r: "roadmap",
          l: "releases",
          e: "reports",
          s: "settings",
          p: "projects",
        };
        if (destMap[lower]) {
          handlers.onNavigate?.(destMap[lower]);
          return;
        }
      }

      if (e.key.toLowerCase() === "g") {
        pendingSequence = "g";
        timer = setTimeout(clearSequence, 1500);
        return;
      }

      if (e.key === "c" || e.key === "C") {
        handlers.onCreateIssue?.();
        return;
      }

      if (e.key === "/") {
        handlers.onFocusSearch?.();
        return;
      }

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        handlers.onOpenHelp?.();
        return;
      }

      if (e.key === "[") {
        handlers.onToggleSidebar?.();
        return;
      }
    };

    return { dispatch, getPendingSequence: () => pendingSequence };
  }

  it("fires single-key actions when not in input", () => {
    const onCreateIssue = vi.fn();
    const onFocusSearch = vi.fn();
    const onOpenHelp = vi.fn();
    const onToggleSidebar = vi.fn();
    const onCloseModal = vi.fn();

    const { dispatch } = createShortcutDispatcher({
      onCreateIssue,
      onFocusSearch,
      onOpenHelp,
      onToggleSidebar,
      onCloseModal,
    });

    dispatch({ key: "c" });
    expect(onCreateIssue).toHaveBeenCalledTimes(1);

    dispatch({ key: "/" });
    expect(onFocusSearch).toHaveBeenCalledTimes(1);

    dispatch({ key: "?" });
    expect(onOpenHelp).toHaveBeenCalledTimes(1);

    dispatch({ key: "[" });
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);

    dispatch({ key: "Escape" });
    expect(onCloseModal).toHaveBeenCalledTimes(1);
  });

  it("suppresses single-key shortcuts when user is in an input or textarea", () => {
    const onCreateIssue = vi.fn();
    const onFocusSearch = vi.fn();
    const onOpenHelp = vi.fn();
    const onToggleSidebar = vi.fn();

    const { dispatch } = createShortcutDispatcher({
      onCreateIssue,
      onFocusSearch,
      onOpenHelp,
      onToggleSidebar,
    });

    const inputTarget = { tagName: "INPUT" };
    dispatch({ key: "c", target: inputTarget });
    dispatch({ key: "/", target: inputTarget });
    dispatch({ key: "?", target: inputTarget });
    dispatch({ key: "[", target: inputTarget });

    expect(onCreateIssue).not.toHaveBeenCalled();
    expect(onFocusSearch).not.toHaveBeenCalled();
    expect(onOpenHelp).not.toHaveBeenCalled();
    expect(onToggleSidebar).not.toHaveBeenCalled();
  });

  it("handles 'g' two-key navigation sequences", () => {
    const onNavigate = vi.fn();
    const { dispatch, getPendingSequence } = createShortcutDispatcher({ onNavigate });

    // Press 'g'
    dispatch({ key: "g" });
    expect(getPendingSequence()).toBe("g");
    expect(onNavigate).not.toHaveBeenCalled();

    // Press 'b' (Backlog)
    dispatch({ key: "b" });
    expect(onNavigate).toHaveBeenCalledWith("backlog");
    expect(getPendingSequence()).toBeNull();

    // Press 'g' then 'd' (Board)
    dispatch({ key: "g" });
    dispatch({ key: "d" });
    expect(onNavigate).toHaveBeenCalledWith("board");

    // Press 'g' then 'p' (Projects)
    dispatch({ key: "g" });
    dispatch({ key: "p" });
    expect(onNavigate).toHaveBeenCalledWith("projects");
  });

  it("resets 'g' sequence if an unrelated key is pressed", () => {
    const onNavigate = vi.fn();
    const { dispatch, getPendingSequence } = createShortcutDispatcher({ onNavigate });

    dispatch({ key: "g" });
    expect(getPendingSequence()).toBe("g");

    // Press 'x' (unrelated)
    dispatch({ key: "x" });
    expect(onNavigate).not.toHaveBeenCalled();
    expect(getPendingSequence()).toBeNull();
  });
});
