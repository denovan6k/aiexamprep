"use client";

import { Loader2, Users } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCommunityGroupMutation } from "@/hooks/use-community";
import type { CommunityGroup } from "@/lib/community";
import { showError, showSuccess } from "@/lib/toast";

type CreateGroupDialogProps = {
  trigger?: ReactNode;
  onCreated?: (group: CommunityGroup) => void;
};

export function CreateGroupDialog({ trigger, onCreated }: CreateGroupDialogProps) {
  const createMutation = useCreateCommunityGroupMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [schoolName, setSchoolName] = useState("");

  function reset() {
    setName("");
    setDescription("");
    setVisibility("public");
    setSchoolName("");
    createMutation.reset();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        school_name: schoolName.trim() || undefined
      },
      {
        onSuccess: (group) => {
          showSuccess("Study group created.");
          onCreated?.(group);
          reset();
          setOpen(false);
        },
        onError: (err) => showError(err, "Failed to create group.")
      }
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <DialogTitle>Create study group</DialogTitle>
          <DialogDescription>Start a community for exam prep, resource sharing, and discussion.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input id="group-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-description">Description</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-visibility">Visibility</Label>
            <select
              id="group-visibility"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
            >
              <option value="public">Public — anyone can discover and join</option>
              <option value="school">School — visible to your institution</option>
              <option value="private">Private — members only</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="school-name">School name (optional)</Label>
            <Input id="school-name" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
