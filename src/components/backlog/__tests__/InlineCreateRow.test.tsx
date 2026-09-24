// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InlineCreateRow from "../InlineCreateRow";

describe("InlineCreateRow", () => {
  it("stays open and empty after Enter, ready for the next issue", async () => {
    const onCreate = vi.fn(async () => true);
    const user = userEvent.setup();
    render(<InlineCreateRow label="Create an issue in Sprint 1" onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: "Create issue" }));
    const input = screen.getByRole("textbox", { name: "Create an issue in Sprint 1" });
    await user.type(input, "First{Enter}");
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("First", "STORY"));
    expect((input as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(input);

    await user.type(input, "Second{Enter}");
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(2));
  });

  it("keeps the title when creating fails", async () => {
    const onCreate = vi.fn(async () => false);
    const user = userEvent.setup();
    render(<InlineCreateRow label="Create an issue in the backlog" onCreate={onCreate} />);
    await user.click(screen.getByRole("button", { name: "Create issue" }));
    const input = screen.getByRole("textbox", { name: "Create an issue in the backlog" });
    await user.type(input, "Keep me{Enter}");
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("Keep me"));
  });

  it("closes with Escape and gives focus back to the button", async () => {
    const user = userEvent.setup();
    render(<InlineCreateRow label="Create an issue in the backlog" onCreate={vi.fn(async () => true)} />);
    await user.click(screen.getByRole("button", { name: "Create issue" }));
    await user.keyboard("{Escape}");
    const button = await screen.findByRole("button", { name: "Create issue" });
    await waitFor(() => expect(document.activeElement).toBe(button));
  });
});
