"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Search, Shield, UserCheck, UserX } from "lucide-react";
import { useState } from "react";

import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminTableActions, AdminTableShell } from "@/components/admin/admin-table-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, SectionGrid, Stat } from "@/components/page-kit";
import { useAdminUsersQuery, useUpdateAdminUserMutation } from "@/hooks/use-admin";
import { useListPageState } from "@/hooks/use-list-page-state";
import type { AdminUserListItem } from "@/lib/admin";
import { showError, showSuccess } from "@/lib/toast";
import { asRoute } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";

function UserStatusBadge({ user }: { user: AdminUserListItem }) {
  return (
    <Badge variant={user.is_active ? "outline" : "destructive"}>
      {user.is_active ? "Active" : "Suspended"}
    </Badge>
  );
}

export function AdminUsersPanel() {
  const router = useRouter();
  const listState = useListPageState();
  const [roleFilter, setRoleFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const updateUser = useUpdateAdminUserMutation();

  const { data, isLoading, error, isFetching } = useAdminUsersQuery({
    limit: listState.limit,
    offset: listState.offset,
    q: listState.query || undefined,
    role: roleFilter === "all" ? undefined : roleFilter,
    plan: planFilter === "all" ? undefined : planFilter,
    is_active: activeFilter === "all" ? undefined : activeFilter === "active"
  });

  const users = data?.items ?? [];
  const total = data?.total ?? 0;

  async function handleToggleActive(user: AdminUserListItem) {
    try {
      await updateUser.mutateAsync({
        userId: user.id,
        body: { is_active: !user.is_active }
      });
      showSuccess(user.is_active ? "User suspended." : "User reactivated.");
    } catch (err) {
      showError(err, "Failed to update user.");
    }
  }

  async function handleToggleRole(user: AdminUserListItem) {
    const nextRole = user.role === "super_admin" ? "user" : "super_admin";
    try {
      await updateUser.mutateAsync({
        userId: user.id,
        body: { role: nextRole }
      });
      showSuccess(nextRole === "super_admin" ? "Super admin granted." : "Super admin removed.");
    } catch (err) {
      showError(err, "Failed to update role.");
    }
  }

  const toolbar = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <form
        className="flex w-full max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          listState.applySearch();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={listState.searchInput}
            onChange={(event) => listState.setSearchInput(event.target.value)}
            placeholder="Search name or email"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={isFetching}>
          {isFetching ? <Loader2 className="size-4 animate-spin" /> : "Search"}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Select value={roleFilter} onValueChange={(value) => { setRoleFilter(value); listState.setOffset(0); }}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="super_admin">Super admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={(value) => { setPlanFilter(value); listState.setOffset(0); }}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro_monthly">Pro monthly</SelectItem>
            <SelectItem value="pro_yearly">Pro yearly</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={(value) => { setActiveFilter(value); listState.setOffset(0); }}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        {(listState.query || roleFilter !== "all" || planFilter !== "all" || activeFilter !== "all") && (
          <Button
            variant="ghost"
            onClick={() => {
              listState.resetFilters();
              setRoleFilter("all");
              setPlanFilter("all");
              setActiveFilter("all");
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <AdminGuard>
      <PageHeader
        eyebrow="Admin"
        title="Users"
        description="Search, filter, and manage platform users."
      />

      <div className="mt-8 space-y-4">
        <SectionGrid cols={3}>
          <Stat label="Total matching" value={String(total)} />
          <Stat label="On this page" value={String(users.length)} />
          <Stat label="Active filter" value={listState.query || "None"} />
        </SectionGrid>

        {error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : null}

        <AdminTableShell
          title="User directory"
          description="Click a row or use actions to manage accounts."
          toolbar={toolbar}
          columns={["User", "Plan", "Role", "Status", "Joined", "Actions"]}
          columnClassNames={[undefined, undefined, undefined, undefined, "w-[120px]", "w-[90px] text-right"]}
          isLoading={isLoading}
          isEmpty={!isLoading && users.length === 0}
          emptyTitle="No users found"
          emptyDescription="Try different search terms or filters."
          total={total}
          limit={listState.limit}
          offset={listState.offset}
          onPageChange={listState.setOffset}
          mobileCards={
            isLoading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <Card key={`mobile-skeleton-${index}`}>
                    <CardContent className="h-24 animate-pulse bg-muted/40 p-4" />
                  </Card>
                ))
              : users.map((user) => (
                  <Card
                    key={user.id}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => router.push(asRoute(`/admin/users/${user.id}`))}
                  >
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{user.full_name}</p>
                          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <UserStatusBadge user={user} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{user.plan_code}</Badge>
                        <Badge variant={user.role === "super_admin" ? "default" : "secondary"}>{user.role}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))
          }
        >
          {users.map((user) => (
            <TableRow
              key={user.id}
              className="cursor-pointer"
              onClick={() => router.push(asRoute(`/admin/users/${user.id}`))}
            >
              <TableCell>
                <div>
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{user.plan_code}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={user.role === "super_admin" ? "default" : "secondary"}>{user.role}</Badge>
              </TableCell>
              <TableCell>
                <UserStatusBadge user={user} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(user.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <AdminTableActions>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={asRoute(`/admin/users/${user.id}`)}>View details</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={updateUser.isPending}
                        onClick={() => void handleToggleActive(user)}
                      >
                        {user.is_active ? (
                          <>
                            <UserX className="mr-2 size-4" /> Suspend user
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-2 size-4" /> Reactivate user
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={updateUser.isPending}
                        onClick={() => void handleToggleRole(user)}
                      >
                        <Shield className="mr-2 size-4" />
                        {user.role === "super_admin" ? "Remove super admin" : "Make super admin"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </AdminTableActions>
              </TableCell>
            </TableRow>
          ))}
        </AdminTableShell>
      </div>
    </AdminGuard>
  );
}
