import { DashboardChat } from "@/components/chat/dashboard-chat";

export default async function ChatThreadPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <DashboardChat key={chatId} initialThreadId={chatId} />
    </div>
  );
}
