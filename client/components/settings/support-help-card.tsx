"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateModerationAppealMutation, useCreateSupportTicketMutation, useMySupportTicketsQuery } from "@/hooks/use-support";
import { showError, showSuccess } from "@/lib/toast";

const ticketSchema = z.object({
  category: z.enum(["general", "billing", "account", "product", "other"]),
  subject: z.string().min(1, "Subject is required").max(255),
  body: z.string().min(1, "Message is required").max(10000)
});

const appealSchema = z.object({
  appeal_type: z.enum(["account_suspension", "content_removal", "other"]),
  reason: z.string().min(1, "Reason is required").max(10000)
});

type TicketFormValues = z.infer<typeof ticketSchema>;
type AppealFormValues = z.infer<typeof appealSchema>;

export function SupportHelpCard() {
  const { data: tickets } = useMySupportTicketsQuery();
  const createTicket = useCreateSupportTicketMutation();
  const createAppeal = useCreateModerationAppealMutation();

  const ticketForm = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { category: "general", subject: "", body: "" }
  });

  const appealForm = useForm<AppealFormValues>({
    resolver: zodResolver(appealSchema),
    defaultValues: { appeal_type: "account_suspension", reason: "" }
  });

  function onSubmitTicket(values: TicketFormValues) {
    createTicket.mutate(values, {
      onSuccess: () => {
        ticketForm.reset({ category: "general", subject: "", body: "" });
        showSuccess("Support ticket submitted. Our team will respond soon.");
      },
      onError: (err) => showError(err, "Failed to submit support ticket.")
    });
  }

  function onSubmitAppeal(values: AppealFormValues) {
    createAppeal.mutate(values, {
      onSuccess: () => {
        appealForm.reset({ appeal_type: "account_suspension", reason: "" });
        showSuccess("Appeal submitted for review.");
      },
      onError: (err) => showError(err, "Failed to submit appeal.")
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submit a support ticket</CardTitle>
          <CardDescription>Get help with billing, account access, or product questions.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={ticketForm.handleSubmit(onSubmitTicket)}>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={ticketForm.watch("category")}
                onValueChange={(value) =>
                  ticketForm.setValue("category", value as TicketFormValues["category"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input id="ticket-subject" {...ticketForm.register("subject")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-body">Message</Label>
              <Textarea id="ticket-body" rows={5} {...ticketForm.register("body")} />
            </div>
            <Button type="submit" disabled={createTicket.isPending}>
              {createTicket.isPending ? <Loader2 className="size-4 animate-spin" /> : "Submit ticket"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submit a moderation appeal</CardTitle>
          <CardDescription>Appeal account suspensions or content moderation actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={appealForm.handleSubmit(onSubmitAppeal)}>
            <div className="space-y-2">
              <Label>Appeal type</Label>
              <Select
                value={appealForm.watch("appeal_type")}
                onValueChange={(value) =>
                  appealForm.setValue("appeal_type", value as AppealFormValues["appeal_type"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account_suspension">Account suspension</SelectItem>
                  <SelectItem value="content_removal">Content removal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appeal-reason">Reason</Label>
              <Textarea id="appeal-reason" rows={5} {...appealForm.register("reason")} />
            </div>
            <Button type="submit" disabled={createAppeal.isPending}>
              {createAppeal.isPending ? <Loader2 className="size-4 animate-spin" /> : "Submit appeal"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {(tickets?.items ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your recent tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets?.items.map((ticket) => (
              <div key={ticket.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{ticket.subject}</p>
                <p className="text-muted-foreground">
                  {ticket.status} · {new Date(ticket.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
