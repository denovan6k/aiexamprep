"use client";

import { RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

type RefreshPlanDialogProps = {
  disabled?: boolean;
  isPending?: boolean;
  trigger?: ReactNode;
  onConfirm: () => void | Promise<void>;
};

export function RefreshPlanDialog({ disabled, isPending, trigger, onConfirm }: RefreshPlanDialogProps) {
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    await onConfirm();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2" disabled={disabled || isPending}>
            <RefreshCw className={isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh plan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refresh today&apos;s plan?</DialogTitle>
          <DialogDescription>
            This rebuilds your study queue using upcoming exams, due flashcards, weak quiz topics, and
            unfinished remediation. Completed items may change if priorities shift.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Keep current plan
          </Button>
          <Button type="button" disabled={isPending} onClick={() => void handleConfirm()}>
            {isPending ? "Refreshing..." : "Refresh plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
