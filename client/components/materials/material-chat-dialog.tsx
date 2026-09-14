"use client";

import { useState } from "react";
import { FileQuestion, Loader2, Send } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateMaterialChatSessionMutation,
  useSendMaterialChatMessageMutation
} from "@/hooks/use-materials";
import type {
  MaterialChatContextIndicator,
  MaterialChatMessage,
  MaterialSummary
} from "@/lib/materials";
import { showError } from "@/lib/toast";
import { cn } from "@/lib/utils";

type MaterialChatDialogProps = {
  material: MaterialSummary;
  className?: string;
};

export function MaterialChatDialog({ material, className }: MaterialChatDialogProps) {
  const createSessionMutation = useCreateMaterialChatSessionMutation();
  const sendMessageMutation = useSendMaterialChatMessageMutation();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<MaterialChatMessage[]>([]);
  const [context, setContext] = useState<MaterialChatContextIndicator[]>([]);

  const canChat = material.status === "processed";
  const isSending = createSessionMutation.isPending || sendMessageMutation.isPending;

  async function handleSend() {
    const content = input.trim();
    if (!content || !canChat || isSending) return;

    try {
      let session = sessionId;
      if (!session) {
        const created = await createSessionMutation.mutateAsync({
          materialId: material.id,
          title: `Chat about ${material.title || material.file_name}`
        });
        session = created.id;
        setSessionId(session);
      }

      setInput("");
      const response = await sendMessageMutation.mutateAsync({
        materialId: material.id,
        sessionId: session,
        content
      });
      setMessages((prev) => [...prev, response.user_message, response.assistant_message]);
      setContext(response.context_indicators);
    } catch (sendError) {
      showError(sendError, "Failed to send message.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn("gap-1.5", className)} disabled={!canChat}>
          <FileQuestion className="h-3.5 w-3.5" />
          Chat
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{material.title || material.file_name}</DialogTitle>
          <DialogDescription>Ask questions using only this file as context.</DialogDescription>
        </DialogHeader>

        {!canChat ? (
          <Alert>
            <AlertDescription>This material needs to finish processing before chat is available.</AlertDescription>
          </Alert>
        ) : null}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-md border border-border bg-muted/20 p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Start with a focused question, like asking for the main ideas, likely exam traps, or a short explanation
              of one section.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-md px-3 py-2 text-sm",
                  message.role === "user" ? "ml-auto max-w-[85%] bg-primary text-primary-foreground" : "bg-background"
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
            ))
          )}
        </div>

        {context.length ? (
          <div className="flex flex-wrap gap-2">
            {context.slice(0, 4).map((item) => (
              <Badge key={item.chunk_id} variant="secondary">
                {item.material_title} · {item.token_count} tokens
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about this material..."
            disabled={!canChat || isSending}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            aria-label="Send message"
            disabled={!input.trim() || !canChat || isSending}
            onClick={() => void handleSend()}
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
