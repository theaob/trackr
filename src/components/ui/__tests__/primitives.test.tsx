// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, IconButton } from "../Button";
import { Field, Input, Textarea } from "../Field";
import { Checkbox, Switch } from "../Checkbox";
import { Dialog, DialogContent, DialogTrigger, Sheet, SheetContent, SheetTrigger } from "../Dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../Menu";
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from "../Popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../Tabs";
import { ToastProvider, useToast } from "../Toast";
import { Combobox, Select, type SelectOption } from "../Select";
import { StatusLozenge } from "../StatusLozenge";

describe("Button", () => {
  it("never submits a form by accident", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Cancel</Button>
      </form>
    );
    screen.getByRole("button", { name: "Cancel" }).click();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is disabled and marked busy while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("uses the design tokens, not the jira palette", () => {
    render(<Button variant="primary">Create</Button>);
    const className = screen.getByRole("button").className;
    expect(className).toContain("bg-accent");
    expect(className).not.toContain("jira");
  });
});

describe("IconButton", () => {
  it("is named by its label", () => {
    render(<IconButton label="Close panel" icon={<svg />} />);
    const button = screen.getByRole("button", { name: "Close panel" });
    expect(button.getAttribute("title")).toBe("Close panel");
  });
});

describe("Field", () => {
  it("labels its control and describes it with the hint", () => {
    render(
      <Field label="Project key" hint="Two to ten capital letters">
        <Input />
      </Field>
    );
    const input = screen.getByRole("textbox", { name: "Project key" });
    expect(input.getAttribute("aria-invalid")).toBeNull();
    const hint = document.getElementById(input.getAttribute("aria-describedby")!);
    expect(hint?.textContent).toBe("Two to ten capital letters");
  });

  it("replaces the hint with an announced error and marks the control invalid", () => {
    render(
      <Field label="Summary" hint="Short" error="Summary is required" required>
        <Textarea />
      </Field>
    );
    const textarea = screen.getByRole("textbox", { name: /Summary/ });
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    expect(textarea).toHaveProperty("required", true);
    expect(screen.getByRole("alert").textContent).toBe("Summary is required");
    expect(document.getElementById(textarea.getAttribute("aria-describedby")!)?.textContent).toBe("Summary is required");
    expect(screen.queryByText("Short")).toBeNull();
  });

  it("gives the control a fixed id when asked, still labelled", () => {
    render(
      <Field label="Email" id="email">
        <Input id="ignored" />
      </Field>
    );
    expect(screen.getByLabelText("Email").id).toBe("email");
  });
});

describe("Checkbox and Switch", () => {
  it("toggles a checkbox by its label and shows the mixed state", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Checkbox label="Select all" onChange={onChange} />);
    await userEvent.click(screen.getByText("Select all"));
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender(<Checkbox label="Select all" indeterminate onChange={onChange} />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).indeterminate).toBe(true);
  });

  it("switches on and off from the keyboard", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Email me about mentions" onCheckedChange={onCheckedChange} />);
    const toggle = screen.getByRole("switch", { name: "Email me about mentions" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    toggle.focus();
    await userEvent.keyboard(" ");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
  });

  it("follows the checked prop when controlled", async () => {
    render(<Switch aria-label="Compact" checked={false} onCheckedChange={() => {}} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });
});

describe("Dialog", () => {
  it("opens as a labelled modal, traps focus, closes on Escape and returns focus", async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>New sprint</Button>
        </DialogTrigger>
        <DialogContent title="Create sprint" description="Sprints hold the work for one iteration.">
          <Field label="Name">
            <Input />
          </Field>
        </DialogContent>
      </Dialog>
    );
    const trigger = screen.getByRole("button", { name: "New sprint" });
    await userEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Create sprint" });
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("has a close button and can hide its title visually", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent title="Issue APOLLO-3" showTitle={false}>
          Body
        </DialogContent>
      </Dialog>
    );
    const dialog = await screen.findByRole("dialog", { name: "Issue APOLLO-3" });
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(dialog.isConnected).toBe(false));
  });

  it("opens a sheet the same way", async () => {
    render(
      <Sheet>
        <SheetTrigger asChild>
          <Button>Menu</Button>
        </SheetTrigger>
        <SheetContent side="left" title="Navigation">
          Links
        </SheetContent>
      </Sheet>
    );
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(await screen.findByRole("dialog", { name: "Navigation" })).toBeTruthy();
  });
});

describe("Menu", () => {
  it("opens from the keyboard, moves with arrows and runs the chosen item", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <Menu>
        <MenuTrigger asChild>
          <Button>Actions</Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onEdit} shortcut="E">
            Edit
          </MenuItem>
          <MenuItem onSelect={onDelete} danger>
            Delete
          </MenuItem>
        </MenuContent>
      </Menu>
    );
    screen.getByRole("button", { name: "Actions" }).focus();
    await userEvent.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    expect(menu).toBeTruthy();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});

describe("Popover and Tooltip", () => {
  it("opens a popover from its trigger and closes on Escape", async () => {
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button>Due date</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Choose a due date">Calendar</PopoverContent>
      </Popover>
    );
    await userEvent.click(screen.getByRole("button", { name: "Due date" }));
    expect(await screen.findByRole("dialog", { name: "Choose a due date" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows a tooltip on keyboard focus", async () => {
    render(
      <Tooltip content="Watch this issue" delay={0}>
        <IconButton label="Watch" icon={<svg />} />
      </Tooltip>
    );
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toBeTruthy();
    expect(screen.getByRole("tooltip").textContent).toBe("Watch this issue");
  });
});

describe("Tabs", () => {
  it("switches panels with the arrow keys", async () => {
    render(
      <Tabs defaultValue="comments">
        <TabsList aria-label="Activity">
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="comments">No comments</TabsContent>
        <TabsContent value="history">Created by Ada</TabsContent>
      </Tabs>
    );
    screen.getByRole("tab", { name: "Comments" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "History" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Created by Ada");
  });
});

describe("Toast", () => {
  function Saver({ tone }: { tone?: "success" | "danger" }) {
    const { toast } = useToast();
    return <Button onClick={() => toast({ title: tone === "danger" ? "Couldn't save" : "Saved", tone })}>Save</Button>;
  }

  it("announces a toast politely and dismisses it after a while", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <ToastProvider>
          <Saver tone="success" />
        </ToastProvider>
      );
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(screen.getByRole("status").textContent).toContain("Saved");
      act(() => {
        vi.advanceTimersByTime(5100);
      });
      expect(screen.getByRole("status").textContent).not.toContain("Saved");
    } finally {
      vi.useRealTimers();
    }
  });

  it("announces failures assertively and can be dismissed", async () => {
    render(
      <ToastProvider>
        <Saver tone="danger" />
      </ToastProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Couldn't save");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(alert.textContent).not.toContain("Couldn't save");
  });

  it("requires a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Saver />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

describe("Select and Combobox", () => {
  const people: SelectOption[] = [
    { value: "ada", label: "Ada Lovelace", description: "ada@example.com" },
    { value: "alan", label: "Alan Turing", disabled: true },
    { value: "grace", label: "Grace Hopper" },
  ];

  function Picker({ searchable = false }: { searchable?: boolean }) {
    const [value, setValue] = useState<string | null>(null);
    const Component = searchable ? Combobox : Select;
    return (
      <Field label="Assignee">
        <Component options={people} value={value} onChange={setValue} placeholder="Unassigned" />
      </Field>
    );
  }

  it("is a labelled combobox button that opens a listbox", async () => {
    render(<Picker />);
    const trigger = screen.getByRole("combobox", { name: "Assignee" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.textContent).toContain("Unassigned");
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(await screen.findByRole("listbox")).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("chooses with the arrow keys, skipping disabled options, and returns focus", async () => {
    render(<Picker />);
    const trigger = screen.getByRole("combobox", { name: "Assignee" });
    await userEvent.click(trigger);
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(trigger.textContent).toContain("Grace Hopper");
    expect(document.activeElement).toBe(trigger);
  });

  it("jumps by typing the start of a name", async () => {
    render(<Picker />);
    await userEvent.click(screen.getByRole("combobox", { name: "Assignee" }));
    const listbox = await screen.findByRole("listbox");
    await userEvent.keyboard("g");
    const active = listbox.getAttribute("aria-activedescendant");
    expect(document.getElementById(active!)?.textContent).toContain("Grace Hopper");
  });

  it("marks the chosen option selected when reopened", async () => {
    render(<Picker />);
    const trigger = screen.getByRole("combobox", { name: "Assignee" });
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole("option", { name: /Ada Lovelace/ }));
    await userEvent.click(trigger);
    const option = await screen.findByRole("option", { name: /Ada Lovelace/ });
    expect(option.getAttribute("aria-selected")).toBe("true");
  });

  it("tells assistive tech when a choice is required", () => {
    render(
      <Field label="Priority" required>
        <Select options={people} value={null} onChange={() => {}} />
      </Field>
    );
    const trigger = screen.getByRole("combobox", { name: /Priority/ });
    expect(trigger.getAttribute("aria-required")).toBe("true");
    expect(trigger.hasAttribute("required")).toBe(false);
  });

  it("filters as you type in a combobox and shows an empty message", async () => {
    render(<Picker searchable />);
    await userEvent.click(screen.getByRole("combobox", { name: "Assignee" }));
    const search = await screen.findByRole("combobox", { name: "Search" });
    expect(document.activeElement).toBe(search);
    await userEvent.keyboard("hopper");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Grace Hopper"]);
    expect(document.getElementById(search.getAttribute("aria-activedescendant")!)?.textContent).toContain("Grace Hopper");
    await userEvent.clear(search);
    await userEvent.keyboard("nobody");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matches")).toBeTruthy();
  });
});

describe("StatusLozenge", () => {
  it("writes the label in the text colour over a tint of the status colour", () => {
    render(<StatusLozenge label="In review" color="#8F44FD" />);
    const label = screen.getByText("In review");
    const lozenge = label.parentElement!;
    expect(lozenge.className).toContain("text-ink");
    expect(lozenge.getAttribute("style")).toContain("rgba(143, 68, 253, 0.14)");
  });

  it("falls back to the muted token for a colour it can't read", () => {
    render(<StatusLozenge label="Blocked" color="not-a-colour" />);
    expect(screen.getByText("Blocked").parentElement!.getAttribute("style")).toContain("var(--color-muted)");
  });
});
