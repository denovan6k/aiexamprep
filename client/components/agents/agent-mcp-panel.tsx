"use client";

import { AgentMcpPanelSkeleton } from "@/components/agents/agent-mcp-panel-skeleton";
import { Loader2, Plug, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  useAgentMcpConnectionsQuery,
  useCreateAgentMcpMutation,
  useDeleteAgentMcpMutation,
  useSyncAgentMcpMutation,
  useTestAgentMcpMutation
} from "@/hooks/use-agent-mcp";
import { showError, showInfo, showSuccess } from "@/lib/toast";

type AgentMcpPanelProps = {
  agentId: string;
};

export function AgentMcpPanel({ agentId }: AgentMcpPanelProps) {
  const { data: connections = [], isLoading } = useAgentMcpConnectionsQuery(agentId);
  const createMutation = useCreateAgentMcpMutation(agentId);
  const deleteMutation = useDeleteAgentMcpMutation(agentId);
  const syncMutation = useSyncAgentMcpMutation(agentId);
  const testMutation = useTestAgentMcpMutation(agentId);

  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [authType, setAuthType] = useState("none");
  const [bearerToken, setBearerToken] = useState("");

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !serverUrl.trim()) return;
    createMutation.mutate(
      {
        name: name.trim(),
        server_url: serverUrl.trim(),
        auth_type: authType,
        bearer_token: authType === "bearer" ? bearerToken : undefined
      },
      {
        onSuccess: () => {
          showSuccess("MCP connection added.");
          setName("");
          setServerUrl("");
          setBearerToken("");
          setAuthType("none");
        },
        onError: (err) => showError(err, "Failed to add MCP connection.")
      }
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">MCP connections</h2>
        <p className="text-sm text-muted-foreground">
          Connect external tool servers this agent can call during chat.
        </p>
      </div>

      {isLoading ? (
        <AgentMcpPanelSkeleton />
      ) : connections.length === 0 ? (
        <p className="text-sm text-muted-foreground">No MCP connections yet.</p>
      ) : (
        <div className="space-y-3">
          {connections.map((connection) => (
            <div key={connection.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Plug className="h-4 w-4 text-primary" />
                    <p className="font-medium">{connection.name}</p>
                    {!connection.enabled ? <Badge variant="outline">Disabled</Badge> : null}
                  </div>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{connection.server_url}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {(connection.discovered_tools ?? []).length} tools · {connection.auth_type}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={syncMutation.isPending}
                    onClick={() =>
                      syncMutation.mutate(connection.id, {
                        onSuccess: () => showSuccess("MCP connection synced."),
                        onError: (err) => showError(err, "Failed to sync MCP connection.")
                      })
                    }
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={testMutation.isPending}
                    onClick={() =>
                      testMutation.mutate(connection.id, {
                        onSuccess: (result) =>
                          showInfo(result.ok ? "Connection test passed." : "Connection test failed."),
                        onError: (err) => showError(err, "Failed to test MCP connection.")
                      })
                    }
                  >
                    Test
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() =>
                      deleteMutation.mutate(connection.id, {
                        onSuccess: () => showSuccess("MCP connection removed."),
                        onError: (err) => showError(err, "Failed to delete MCP connection.")
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-dashed border-border p-4">
        <p className="text-sm font-medium">Add connection</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mcp-name">Label</Label>
            <Input id="mcp-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Notion" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mcp-auth">Auth</Label>
            <Select value={authType} onValueChange={setAuthType}>
              <SelectTrigger id="mcp-auth"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="bearer">Bearer token</SelectItem>
                <SelectItem value="oauth">OAuth</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="mcp-url">Server URL</Label>
            <Input
              id="mcp-url"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder="https://mcp.example.com/mcp"
            />
          </div>
          {authType === "bearer" ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="mcp-token">Bearer token</Label>
              <Input id="mcp-token" type="password" value={bearerToken} onChange={(event) => setBearerToken(event.target.value)} />
            </div>
          ) : null}
        </div>
        <Button type="submit" disabled={createMutation.isPending || !name.trim() || !serverUrl.trim()}>
          {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Add connection
        </Button>
      </form>
    </div>
  );
}
