import { apiRequest } from "@/lib/api";
import type { SupportTicket } from "@/lib/admin";
import { buildListQuery, type ListParams, type PaginatedResult } from "@/lib/pagination";

export type SupportTicketCreateInput = {
  category: "general" | "billing" | "account" | "product" | "other";
  subject: string;
  body: string;
};

export type ModerationAppealCreateInput = {
  appeal_type: "account_suspension" | "content_removal" | "other";
  reason: string;
  reference_type?: string;
  reference_id?: string;
};

export function createSupportTicket(token: string, body: SupportTicketCreateInput) {
  return apiRequest<SupportTicket>("/support/tickets", { token, method: "POST", body: JSON.stringify(body) });
}

export function listMySupportTickets(token: string, params?: ListParams) {
  return apiRequest<PaginatedResult<SupportTicket>>(`/support/tickets/me${buildListQuery(params)}`, { token });
}

export function createModerationAppeal(token: string, body: ModerationAppealCreateInput) {
  return apiRequest<import("@/lib/admin").ModerationAppeal>("/moderation/appeals", {
    token,
    method: "POST",
    body: JSON.stringify(body)
  });
}
