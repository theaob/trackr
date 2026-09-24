"use client";

import React from "react";
import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "./cn";
import { floatingClassName } from "./Popover";

/**
 * Action menus (card, sprint and user menus). Arrow keys move, typing jumps to
 * an item, Escape closes and focus returns to the trigger.
 */
/**
 * Not modal: a modal menu hides the rest of the page from screen readers
 * while it stays focusable, which axe rightly flags. Escape, a click outside
 * and choosing an item still close it and return focus to the trigger.
 */
export function Menu({ modal = false, ...props }: React.ComponentProps<typeof RadixMenu.Root>) {
  return <RadixMenu.Root modal={modal} {...props} />;
}
export const MenuTrigger = RadixMenu.Trigger;
export const MenuGroup = RadixMenu.Group;

export function MenuContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof RadixMenu.Content>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(floatingClassName, "min-w-44 p-1", className)}
        {...props}
      />
    </RadixMenu.Portal>
  );
}

const ITEM =
  "relative flex h-8 cursor-default select-none items-center gap-2 rounded-[4px] px-2 text-[13px] text-ink outline-none " +
  "data-[highlighted]:bg-surface-sunk data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-muted";

export interface MenuItemProps extends React.ComponentProps<typeof RadixMenu.Item> {
  icon?: React.ReactNode;
  /** A keyboard shortcut hint, shown on the right. */
  shortcut?: string;
  /** For destructive actions such as Delete. */
  danger?: boolean;
}

export function MenuItem({ icon, shortcut, danger, className, children, ...props }: MenuItemProps) {
  return (
    <RadixMenu.Item className={cn(ITEM, danger && "text-danger [&>svg]:text-danger", className)} {...props}>
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {shortcut ? <kbd className="font-mono text-[11px] text-muted">{shortcut}</kbd> : null}
    </RadixMenu.Item>
  );
}

export function MenuCheckboxItem({ className, children, ...props }: React.ComponentProps<typeof RadixMenu.CheckboxItem>) {
  return (
    <RadixMenu.CheckboxItem className={cn(ITEM, "pl-8", className)} {...props}>
      <RadixMenu.ItemIndicator className="absolute left-2 inline-flex">
        <Check className="h-4 w-4 text-accent" aria-hidden="true" />
      </RadixMenu.ItemIndicator>
      {children}
    </RadixMenu.CheckboxItem>
  );
}

export const MenuRadioGroup = RadixMenu.RadioGroup;

/** One choice of several, like Light, Dark or Match system. */
export function MenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof RadixMenu.RadioItem>) {
  return (
    <RadixMenu.RadioItem className={cn(ITEM, "pl-8", className)} {...props}>
      <RadixMenu.ItemIndicator className="absolute left-2 inline-flex">
        <Check className="h-4 w-4 text-accent" aria-hidden="true" />
      </RadixMenu.ItemIndicator>
      {children}
    </RadixMenu.RadioItem>
  );
}

export function MenuLabel({ className, ...props }: React.ComponentProps<typeof RadixMenu.Label>) {
  return <RadixMenu.Label className={cn("px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted", className)} {...props} />;
}

export function MenuSeparator({ className, ...props }: React.ComponentProps<typeof RadixMenu.Separator>) {
  return <RadixMenu.Separator className={cn("-mx-1 my-1 h-px bg-subtle", className)} {...props} />;
}
