"use client";

import React from "react";
import * as RadixPopover from "@radix-ui/react-popover";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import { cn } from "./cn";

const FLOATING =
  "z-50 rounded-card border border-subtle bg-surface text-ink shadow-overlay outline-none " +
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 " +
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-100";

/** Floating content anchored to a trigger: pickers, date choosers, the notification list. */
export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;
export const PopoverClose = RadixPopover.Close;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof RadixPopover.Content>) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(FLOATING, "max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-3", className)}
        {...props}
      />
    </RadixPopover.Portal>
  );
}

export interface TooltipProps {
  /** The tip. Supplements a control's name; never the only place information lives. */
  content: React.ReactNode;
  children: React.ReactElement;
  side?: React.ComponentProps<typeof RadixTooltip.Content>["side"];
  /** Milliseconds before showing. */
  delay?: number;
}

/**
 * A short label shown on hover and keyboard focus, replacing title attributes,
 * which keyboard and touch users never see. Escape dismisses it.
 */
export function Tooltip({ content, children, side = "top", delay = 400 }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delay} skipDelayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className={cn(
              "z-[60] max-w-xs rounded-control bg-ink px-2 py-1 text-xs font-medium text-surface shadow-overlay",
              "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
            )}
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

export { FLOATING as floatingClassName };
