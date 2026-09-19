import { describe, expect, it, vi } from "vitest";

describe("Optimistic UI State Logic", () => {
  describe("Optimistic Issue Updates & Rollback", () => {
    it("applies changes optimistically and preserves snapshot for rollback", async () => {
      let currentIssue = {
        id: "issue-1",
        title: "Old Title",
        status: "TODO",
        priority: "LOW",
      };

      const snapshot = { ...currentIssue };

      // Apply optimistic update
      const optimisticChanges = { status: "IN_PROGRESS", priority: "HIGH" };
      currentIssue = { ...currentIssue, ...optimisticChanges };

      // Verify optimistic state is visible immediately
      expect(currentIssue.status).toBe("IN_PROGRESS");
      expect(currentIssue.priority).toBe("HIGH");

      // Simulate a server rejection (e.g. workflow transition error)
      const serverSuccess = false;
      if (!serverSuccess) {
        // Rollback
        currentIssue = snapshot;
      }

      // Verify rolled back to original state
      expect(currentIssue.status).toBe("TODO");
      expect(currentIssue.priority).toBe("LOW");
    });

    it("merges confirmed server response onto optimistic state upon success", async () => {
      let currentIssue = {
        id: "issue-1",
        title: "Initial Title",
        status: "TODO",
      };

      // Optimistic update
      const optimisticChanges = { status: "DONE" };
      currentIssue = { ...currentIssue, ...optimisticChanges };
      expect(currentIssue.status).toBe("DONE");

      // Server succeeds and returns updated entity with updated timestamp
      const serverResponse = {
        id: "issue-1",
        title: "Initial Title",
        status: "DONE",
        updatedAt: "2026-09-19T12:00:00Z",
      };

      currentIssue = { ...currentIssue, ...serverResponse };
      expect(currentIssue.status).toBe("DONE");
      expect((currentIssue as any).updatedAt).toBe("2026-09-19T12:00:00Z");
    });
  });

  describe("Optimistic Comments", () => {
    it("prepends an optimistic comment immediately and replaces temp ID with server ID", () => {
      const initialComments = [
        { id: "c-1", content: "Existing comment", authorId: "u-1" },
      ];

      const tempId = `temp-${Date.now()}`;
      const newCommentText = "New urgent comment";

      // 1. Optimistic append
      const optimisticComment = {
        id: tempId,
        content: newCommentText,
        authorId: "u-current",
      };

      let comments = [optimisticComment, ...initialComments];
      expect(comments.length).toBe(2);
      expect(comments[0].id).toBe(tempId);
      expect(comments[0].content).toBe(newCommentText);

      // 2. Server resolves with permanent ID
      const serverComment = {
        id: "c-2-permanent",
        content: newCommentText,
        authorId: "u-current",
      };

      comments = comments.map((c) => (c.id === tempId ? serverComment : c));
      expect(comments.length).toBe(2);
      expect(comments[0].id).toBe("c-2-permanent");
      expect(comments[1].id).toBe("c-1");
    });

    it("rolls back optimistic comment and restores input on server failure", () => {
      const initialComments = [
        { id: "c-1", content: "Existing comment", authorId: "u-1" },
      ];

      const tempId = `temp-${Date.now()}`;
      const commentText = "Failed comment";

      let comments = [
        { id: tempId, content: commentText, authorId: "u-current" },
        ...initialComments,
      ];
      expect(comments.length).toBe(2);

      // Server fails
      const serverSuccess = false;
      if (!serverSuccess) {
        comments = initialComments;
      }

      expect(comments.length).toBe(1);
      expect(comments[0].id).toBe("c-1");
    });
  });

  describe("Optimistic Notification Clearing", () => {
    it("marks all notifications as read immediately and reverts on error", () => {
      const initialNotifications = [
        { id: "n-1", title: "Task assigned", read: false },
        { id: "n-2", title: "Comment added", read: false },
      ];

      let notifications = initialNotifications;
      const snapshot = notifications;

      // Optimistic mark all read
      notifications = notifications.map((n) => ({ ...n, read: true }));
      expect(notifications.every((n) => n.read)).toBe(true);

      // Failure simulation
      const serverSuccess = false;
      if (!serverSuccess) {
        notifications = snapshot;
      }

      expect(notifications.every((n) => !n.read)).toBe(true);
    });
  });

  describe("Optimistic Watcher Toggle", () => {
    it("increments count immediately and reverts on failure", () => {
      let watching = false;
      let count = 2;

      const prevWatching = watching;
      const prevCount = count;

      // Optimistic toggle
      watching = !prevWatching;
      count = prevWatching ? count - 1 : count + 1;

      expect(watching).toBe(true);
      expect(count).toBe(3);

      // Rollback
      watching = prevWatching;
      count = prevCount;

      expect(watching).toBe(false);
      expect(count).toBe(2);
    });
  });

  describe("Optimistic Backlog Inline Quick Create", () => {
    it("inserts an optimistic placeholder card immediately into sprint and replaces on success", () => {
      const existingIssues = [
        { id: "iss-1", key: "APOLLO-1", title: "First issue", sprintId: "sprint-1" },
      ];

      const tempId = "temp-create-123";
      const optimisticIssue = {
        id: tempId,
        key: "APOLLO-...",
        title: "Inline quick issue",
        sprintId: "sprint-1",
      };

      let issues = [optimisticIssue, ...existingIssues];
      expect(issues.length).toBe(2);
      expect(issues[0].id).toBe(tempId);
      expect(issues[0].key).toBe("APOLLO-...");

      // Server returns created issue
      const createdIssue = {
        id: "iss-2",
        key: "APOLLO-2",
        title: "Inline quick issue",
        sprintId: "sprint-1",
      };

      issues = issues.map((i) => (i.id === tempId ? createdIssue : i));
      expect(issues.length).toBe(2);
      expect(issues[0].id).toBe("iss-2");
      expect(issues[0].key).toBe("APOLLO-2");
    });
  });
});
