"use client";

import React, { useCallback, useRef, useState } from "react";
import { Dialog, DialogContent } from "./Dialog";
import { Button } from "./Button";

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** The confirming button's label; say what happens ("Delete webhook"). */
  confirmLabel: string;
  /** Red for destructive actions (the default); false for everything else. */
  danger?: boolean;
}

/**
 * An accessible stand-in for window.confirm: `await confirm({...})` resolves
 * true or false, and `dialog` must be rendered somewhere in the component.
 *
 *   const [confirm, dialog] = useConfirm();
 *   if (!(await confirm({ title: "Delete it?", confirmLabel: "Delete" }))) return;
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  const dialog = (
    <Dialog open={options !== null} onOpenChange={(open) => !open && settle(false)}>
      {options && (
        <DialogContent
          size="sm"
          role="alertdialog"
          title={options.title}
          description={options.description}
          footer={
            <>
              <Button onClick={() => settle(false)}>Cancel</Button>
              <Button variant={options.danger === false ? "primary" : "danger"} onClick={() => settle(true)}>
                {options.confirmLabel}
              </Button>
            </>
          }
        />
      )}
    </Dialog>
  );

  return [confirm, dialog] as const;
}
