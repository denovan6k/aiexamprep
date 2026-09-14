"use client";

import { Target } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateOnboardingMutation } from "@/hooks/use-core-study";
import { showError, showSuccess } from "@/lib/toast";

const PRESETS = [15, 30, 45, 60, 90];

type AdjustDailyGoalDialogProps = {
  currentMinutes: number;
  trigger?: ReactNode;
  onUpdated?: (minutes: number) => void;
};

export function AdjustDailyGoalDialog({ currentMinutes, trigger, onUpdated }: AdjustDailyGoalDialogProps) {
  const update = useUpdateOnboardingMutation();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(String(currentMinutes));

  useEffect(() => {
    if (open) setMinutes(String(currentMinutes));
  }, [currentMinutes, open]);

  function handleSave() {
    const parsed = Number(minutes);
    if (!Number.isFinite(parsed) || parsed < 5 || parsed > 480) return;

    update.mutate(
      { daily_minutes: parsed },
      {
        onSuccess: () => {
          showSuccess("Daily study goal updated.");
          onUpdated?.(parsed);
          setOpen(false);
        },
        onError: (err) => showError(err, "Failed to update daily goal.")
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Target className="h-4 w-4" />
            Adjust goal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Daily study goal</DialogTitle>
          <DialogDescription>
            Set how many minutes you want to aim for each day. Your Today plan uses this target when
            prioritizing tasks.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="daily-minutes">Minutes per day</Label>
            <Input
              id="daily-minutes"
              type="number"
              min={5}
              max={480}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={Number(minutes) === preset ? "default" : "outline"}
                size="sm"
                onClick={() => setMinutes(String(preset))}
              >
                {preset} min
              </Button>
            ))}
          </div>

        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={update.isPending} onClick={handleSave}>
            {update.isPending ? "Saving..." : "Save goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
