// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useConfirm } from "../ConfirmDialog";

function Harness() {
  const [confirm, dialog] = useConfirm();
  const [result, setResult] = useState("none");
  return (
    <>
      <button
        onClick={async () =>
          setResult(String(await confirm({ title: "Delete Apollo?", description: "It can't be undone.", confirmLabel: "Delete project" })))
        }
      >
        Delete
      </button>
      <output>{result}</output>
      {dialog}
    </>
  );
}

describe("useConfirm", () => {
  it("asks in an alert dialog and resolves true on the confirming button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete Apollo?" });
    expect(dialog.textContent).toContain("It can't be undone.");
    await user.click(screen.getByRole("button", { name: "Delete project" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("true"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("resolves false on Cancel and on Escape, and returns focus", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Delete" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("false"));
    await user.click(trigger);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole("status").textContent).toBe("false");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
