import { describe, expect, it, vi } from "vitest";

describe("Issue navigation logic (Left / Right)", () => {
  const issues = [
    { id: "1", key: "PROJ-1", title: "First Issue" },
    { id: "2", key: "PROJ-2", title: "Second Issue" },
    { id: "3", key: "PROJ-3", title: "Third Issue" },
  ];

  function getNavigationState(currentIssueId: string, list: typeof issues) {
    const currentIndex = list.findIndex((i) => i.id === currentIssueId);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < list.length - 1;
    const prevIssue = hasPrev ? list[currentIndex - 1] : null;
    const nextIssue = hasNext ? list[currentIndex + 1] : null;

    return {
      currentIndex,
      hasPrev,
      hasNext,
      prevIssue,
      nextIssue,
    };
  }

  it("correctly identifies boundaries for the first issue", () => {
    const state = getNavigationState("1", issues);
    expect(state.currentIndex).toBe(0);
    expect(state.hasPrev).toBe(false);
    expect(state.hasNext).toBe(true);
    expect(state.prevIssue).toBeNull();
    expect(state.nextIssue?.key).toBe("PROJ-2");
  });

  it("correctly identifies boundaries for a middle issue", () => {
    const state = getNavigationState("2", issues);
    expect(state.currentIndex).toBe(1);
    expect(state.hasPrev).toBe(true);
    expect(state.hasNext).toBe(true);
    expect(state.prevIssue?.key).toBe("PROJ-1");
    expect(state.nextIssue?.key).toBe("PROJ-3");
  });

  it("correctly identifies boundaries for the last issue", () => {
    const state = getNavigationState("3", issues);
    expect(state.currentIndex).toBe(2);
    expect(state.hasPrev).toBe(true);
    expect(state.hasNext).toBe(false);
    expect(state.prevIssue?.key).toBe("PROJ-2");
    expect(state.nextIssue).toBeNull();
  });

  it("handles unknown or empty list gracefully", () => {
    const state = getNavigationState("unknown", issues);
    expect(state.currentIndex).toBe(-1);
    expect(state.hasPrev).toBe(false);
    expect(state.hasNext).toBe(false);
  });

  it("handles arrow key dispatching without triggering when typing in inputs", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    const handleKeyDown = (e: { key: string; target: any; preventDefault: () => void }) => {
      const target = e.target;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      }
    };

    const preventDefault = vi.fn();

    // ArrowLeft on regular element
    handleKeyDown({ key: "ArrowLeft", target: { tagName: "DIV" }, preventDefault });
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalled();

    // ArrowRight on regular element
    handleKeyDown({ key: "ArrowRight", target: { tagName: "DIV" }, preventDefault });
    expect(onNext).toHaveBeenCalledTimes(1);

    // Arrow keys inside an input field should be suppressed
    handleKeyDown({ key: "ArrowLeft", target: { tagName: "INPUT" }, preventDefault });
    handleKeyDown({ key: "ArrowRight", target: { tagName: "TEXTAREA" }, preventDefault });
    handleKeyDown({ key: "ArrowRight", target: { tagName: "DIV", isContentEditable: true }, preventDefault });

    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
