import { useState } from "react";

import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Spinner } from "./States";

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  requireText,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** When set, the user must type this text before the action is enabled. */
  requireText?: string;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
}) => {
  const [typed, setTyped] = useState("");
  const disabled = pending || (requireText !== undefined && typed !== requireText);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setTyped("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {requireText ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-text">
              Type <span className="font-mono">{requireText}</span> to confirm
            </Label>
            <Input
              id="confirm-text"
              value={typed}
              autoComplete="off"
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={disabled} onClick={() => void onConfirm()}>
            {pending ? <Spinner label="Working…" /> : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
