"use client";

import React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "./cn";

/**
 * Dialogs and sheets. Radix handles the behaviour the hand-built overlays kept
 * getting wrong: focus is trapped inside, Escape and the backdrop close it,
 * the page behind can't scroll, and focus returns to whatever opened it.
 */
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

const WIDTHS = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

interface OverlayContentProps extends Omit<React.ComponentProps<typeof RadixDialog.Content>, "title"> {
  /** Required: every dialog is announced by its title. */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Set to false to keep the title for screen readers but not show it. */
  showTitle?: boolean;
  /** Buttons along the bottom edge. */
  footer?: React.ReactNode;
}

function Header({ title, description, showTitle }: Pick<OverlayContentProps, "title" | "description" | "showTitle">) {
  return (
    <div className={cn("flex flex-col gap-1 pr-8", !showTitle && "sr-only")}>
      <RadixDialog.Title className="text-base font-semibold leading-6 text-ink">{title}</RadixDialog.Title>
      {description ? (
        <RadixDialog.Description className="text-[13px] text-ink-2">{description}</RadixDialog.Description>
      ) : null}
    </div>
  );
}

function CloseButton() {
  return (
    <RadixDialog.Close
      aria-label="Close"
      className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-sunk hover:text-ink"
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </RadixDialog.Close>
  );
}

const BACKDROP =
  "fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

export interface DialogContentProps extends OverlayContentProps {
  size?: keyof typeof WIDTHS;
}

/** A centred dialog. On phones it fills the width with a small margin. */
export function DialogContent({
  title,
  description,
  showTitle = true,
  footer,
  size = "md",
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={BACKDROP} />
      <RadixDialog.Content
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col",
          "rounded-dialog border border-subtle bg-surface text-ink shadow-overlay",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-150",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          WIDTHS[size],
          className
        )}
        {...props}
      >
        <div className="px-5 pb-2 pt-4">
          <Header title={title} description={description} showTitle={showTitle} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-subtle px-5 py-3">{footer}</div> : <div className="h-3" />}
        <CloseButton />
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

const SIDES = {
  right: "inset-y-0 right-0 h-full w-full max-w-md border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  left: "inset-y-0 left-0 h-full w-full max-w-xs border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
  bottom: "inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-dialog border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
} as const;

export interface SheetContentProps extends OverlayContentProps {
  side?: keyof typeof SIDES;
}

/** A panel that slides in from an edge: navigation on phones, an issue beside a list. */
export function SheetContent({
  title,
  description,
  showTitle = true,
  footer,
  side = "right",
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={BACKDROP} />
      <RadixDialog.Content
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed z-50 flex flex-col border-subtle bg-surface text-ink shadow-overlay",
          "data-[state=open]:animate-in data-[state=closed]:animate-out duration-200",
          SIDES[side],
          className
        )}
        {...props}
      >
        <div className="border-b border-subtle px-5 py-4">
          <Header title={title} description={description} showTitle={showTitle} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-subtle px-5 py-3">{footer}</div> : null}
        <CloseButton />
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export { Dialog as Sheet, DialogTrigger as SheetTrigger, DialogClose as SheetClose };
