import { useState } from "react";
import type { CaseStatus } from "@repo/shared";

import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Label } from "@repo/ui/label";
import { Textarea } from "@repo/ui/textarea";
import { Spinner } from "./States";

export type Decision = Extract<CaseStatus, "CONFIRMED" | "DISMISSED" | "CLOSED"> | "REOPEN";

const TITLES: Record<Decision, string> = {
  CONFIRMED: "Confirm risk",
  DISMISSED: "Dismiss case",
  CLOSED: "Close case",
  REOPEN: "Reopen case",
};

const DESCRIPTIONS: Record<Decision, string> = {
  CONFIRMED: "Records that the risk indicators require follow-up. This is not a finding of wrongdoing.",
  DISMISSED: "Records that the indicators are explained or a false positive.",
  CLOSED: "Closes the case without a risk conclusion.",
  REOPEN: "Reopens the case for further review.",
};

export const DecisionDialog = ({
  open,
  onOpenChange,
  decision,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decision: Decision | null;
  pending?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}) => {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason("");
      setTouched(false);
    }
    onOpenChange(next);
  };

  if (!decision) return null;

  const required = decision !== "CLOSED";
  const tooShort = required && reason.trim().length < 10;
  const tooLong = reason.trim().length > 2000;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLES[decision]}</DialogTitle>
          <DialogDescription>{DESCRIPTIONS[decision]}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="decision-reason">
            Reason {required ? "(required, 10 to 2000 characters)" : "(optional)"}
          </Label>
          <Textarea
            id="decision-reason"
            rows={4}
            value={reason}
            onBlur={() => setTouched(true)}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={touched && (tooShort || tooLong)}
            aria-describedby="decision-reason-error"
          />
          {touched && tooShort ? (
            <p id="decision-reason-error" role="alert" className="text-xs text-destructive">
              Enter at least 10 characters.
            </p>
          ) : null}
          {tooLong ? (
            <p id="decision-reason-error" role="alert" className="text-xs text-destructive">
              Keep it under 2000 characters.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={pending || tooLong || (required && tooShort)}
            onClick={() => void onConfirm(reason.trim())}
          >
            {pending ? <Spinner label="Saving…" /> : TITLES[decision]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
