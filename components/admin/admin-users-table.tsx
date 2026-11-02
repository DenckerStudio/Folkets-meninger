'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronsUpDown,
  ArrowDown,
  ArrowUp,
  Columns3,
  Loader2,
  MoreHorizontal,
  Search,
  UserX,
} from 'lucide-react';
import { AdminToast, useAdminToast } from '@/components/admin/app-future/admin-toast';
import type { AdminBulkItemResult, AdminUserRow } from '@/lib/admin/users/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/dashboard/empty-state';
import { cn } from '@/lib/utils';

type ListResponse = {
  page: number;
  pageSize: number;
  total: number;
  users: AdminUserRow[];
};

type RoleFilter = 'all' | 'admin' | 'member';
type TierFilter = 'all' | 'stemme_plus' | 'free';
type StatusFilter = 'all' | 'active' | 'deactivated';

const COLUMN_LABELS: Record<string, string> = {
  user: 'Bruker',
  status: 'Status',
  role: 'Rolle',
  tier: 'Stemme+',
  joined: 'Registrert',
};

function formatDisplayName(user: AdminUserRow): string {
  if (user.displayName?.trim()) return user.displayName.trim();
  const parts = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (parts) return parts;
  return user.email ?? 'Ukjent bruker';
}

function initialsFor(user: AdminUserRow): string {
  const name = formatDisplayName(user);
  const bits = name.split(/\s+/).filter(Boolean);
  if (bits.length >= 2) return `${bits[0]![0] ?? ''}${bits[1]![0] ?? ''}`.toUpperCase();
  return (name.slice(0, 2) || '?').toUpperCase();
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('nb-NO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp className="size-3.5" aria-hidden />;
  if (sorted === 'desc') return <ArrowDown className="size-3.5" aria-hidden />;
  return <ChevronsUpDown className="size-3.5 text-muted-foreground/60" aria-hidden />;
}

function summarizeBulkSkips(results: AdminBulkItemResult[]): string | null {
  const skipped = results.filter((r) => !r.ok);
  if (skipped.length === 0) return null;
  const parts = skipped.slice(0, 3).map((s) => s.message ?? s.reason ?? s.userId);
  const suffix = skipped.length > 3 ? ` (+${skipped.length - 3} til)` : '';
  return `Hoppet over ${skipped.length}: ${parts.join('; ')}${suffix}`;
}

type AdminBulkBodyAction =
  | 'set_admin'
  | 'revoke_admin'
  | 'grant_stemme_plus'
  | 'revoke_stemme_plus'
  | 'deactivate'
  | 'reactivate';

export function AdminUsersTable() {
  const { message, variant, toast } = useAdminToast();
  const [pending, startTransition] = useTransition();

  const [misconfigured, setMisconfigured] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [sorting, setSorting] = useState<SortingState>([{ id: 'joined', desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  const [hardDeleteTarget, setHardDeleteTarget] = useState<AdminUserRow | null>(null);
  const [hardDeleteEmail, setHardDeleteEmail] = useState('');
  const [hardDeleteError, setHardDeleteError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const sortId = sorting[0]?.id;
  const sortParam = sortId === 'user' ? 'display_name' : 'created_at';
  const orderParam = sorting[0]?.desc ? 'desc' : 'asc';

  const loadUsers = useCallback(() => {
    startTransition(async () => {
      setLoadError(null);
      setMisconfigured(false);
      const params = new URLSearchParams();
      if (debouncedQ) params.set('q', debouncedQ);
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (tierFilter !== 'all') params.set('tier', tierFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('sort', sortParam);
      params.set('order', orderParam);
      params.set('page', String(pagination.pageIndex + 1));
      params.set('pageSize', String(pagination.pageSize));

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = (await res.json().catch(() => ({}))) as ListResponse & { error?: string };
      if (!res.ok) {
        if (res.status === 503) {
          setMisconfigured(true);
          setUsers([]);
          setTotal(0);
          setLoadError(
            typeof data.error === 'string'
              ? data.error
              : 'Brukeradmin er ikke tilgjengelig ennå (database-migrasjon mangler)',
          );
          return;
        }
        setLoadError(typeof data.error === 'string' ? data.error : 'Kunne ikke laste brukere.');
        return;
      }
      setUsers(data.users ?? []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
      setRowSelection({});
    });
  }, [
    debouncedQ,
    orderParam,
    pagination.pageIndex,
    pagination.pageSize,
    roleFilter,
    sortParam,
    statusFilter,
    tierFilter,
  ]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const runBulk = useCallback(
    (action: AdminBulkBodyAction) => {
      const selectedIds = Object.keys(rowSelection);
      if (selectedIds.length === 0) return;
      startTransition(async () => {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: selectedIds, action }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          results?: AdminBulkItemResult[];
          error?: string;
        };
        if (!res.ok) {
          toast(typeof data.error === 'string' ? data.error : 'Massehandling feilet', 'error');
          return;
        }
        const summary = summarizeBulkSkips(data.results ?? []);
        if (summary) {
          toast(summary, 'error');
        } else {
          toast('Massehandling fullført');
        }
        loadUsers();
      });
    },
    [loadUsers, rowSelection, toast],
  );

  const runRowDelete = useCallback(
    (user: AdminUserRow) => {
      startTransition(async () => {
        const res = await fetch(`/api/admin/users/${user.userId}?mode=deactivate`, {
          method: 'DELETE',
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast(typeof data.error === 'string' ? data.error : 'Kunne ikke deaktivere bruker', 'error');
          return;
        }
        toast('Bruker deaktivert og anonymisert');
        loadUsers();
      });
    },
    [loadUsers, toast],
  );

  const runRowReactivate = useCallback(
    (user: AdminUserRow) => {
      startTransition(async () => {
        const res = await fetch(`/api/admin/users/${user.userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reactivate: true }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast(typeof data.error === 'string' ? data.error : 'Kunne ikke reaktivere bruker', 'error');
          return;
        }
        toast('Bruker reaktivert');
        loadUsers();
      });
    },
    [loadUsers, toast],
  );

  const confirmHardDelete = () => {
    if (!hardDeleteTarget) return;
    startTransition(async () => {
      setHardDeleteError('');
      const res = await fetch(`/api/admin/users/${hardDeleteTarget.userId}?mode=hard`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: hardDeleteEmail }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setHardDeleteError(typeof data.error === 'string' ? data.error : 'Sletting feilet');
        return;
      }
      toast('Bruker permanent slettet');
      setHardDeleteTarget(null);
      setHardDeleteEmail('');
      loadUsers();
    });
  };

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
            aria-label="Velg alle på siden"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            aria-label={`Velg ${formatDisplayName(row.original)}`}
          />
        ),
      },
      {
        id: 'user',
        accessorFn: (row) => formatDisplayName(row),
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-mx-1 inline-flex items-center gap-1 rounded-md px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            Bruker
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-8 shrink-0 border border-border">
                <AvatarFallback className="text-xs">{initialsFor(user)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {formatDisplayName(user)}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user.email ?? '—'}</p>
              </div>
            </div>
          );
        },
      },
      {
        id: 'status',
        accessorFn: (row) => (row.isDeactivated ? 'deactivated' : 'active'),
        enableSorting: false,
        header: () => (
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Status
          </span>
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.isDeactivated ? 'outline' : 'default'} className="text-xs">
            {row.original.isDeactivated ? 'Deaktivert' : 'Aktiv'}
          </Badge>
        ),
      },
      {
        id: 'role',
        accessorFn: (row) => (row.isAdmin ? 'admin' : 'member'),
        enableSorting: false,
        header: () => (
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Rolle
          </span>
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              'text-sm',
              row.original.isAdmin ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            {row.original.isAdmin ? 'Administrator' : 'Medlem'}
          </span>
        ),
      },
      {
        id: 'tier',
        accessorFn: (row) => row.subscriptionTier,
        enableSorting: false,
        header: () => (
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Stemme+
          </span>
        ),
        cell: ({ row }) => (
          <Badge
            variant={row.original.subscriptionTier === 'stemme_plus' ? 'secondary' : 'outline'}
            className="text-xs"
          >
            {row.original.subscriptionTier === 'stemme_plus' ? 'Aktiv' : 'Gratis'}
          </Badge>
        ),
      },
      {
        id: 'joined',
        accessorFn: (row) => row.createdAt,
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-mx-1 inline-flex items-center gap-1 rounded-md px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            Registrert
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
        ),
      },
      {
        id: 'actions',
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">Handlinger</span>,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Radhandlinger">
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Handlinger</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!user.isDeactivated ? (
                  <DropdownMenuItem onClick={() => runRowDelete(user)}>
                    <UserX className="size-4" />
                    Deaktiver og anonymiser
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => runRowReactivate(user)}>
                    Reaktiver
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    setHardDeleteTarget(user);
                    setHardDeleteEmail('');
                    setHardDeleteError('');
                  }}
                >
                  Slett permanent…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [runRowDelete, runRowReactivate],
  );

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1);

  const table = useReactTable({
    data: users,
    columns,
    pageCount,
    state: { sorting, columnVisibility, rowSelection, pagination },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: true,
    getRowId: (row) => row.userId,
  });

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="space-y-4" data-admin-users-table>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            placeholder="Søk på navn eller e-post…"
            className="pl-9"
            aria-label="Søk brukere"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 xs:grid-cols-3 sm:flex sm:flex-wrap">
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as RoleFilter);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            aria-label="Filter rolle"
          >
            <option value="all">Alle roller</option>
            <option value="admin">Administrator</option>
            <option value="member">Medlem</option>
          </Select>
          <Select
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value as TierFilter);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            aria-label="Filter Stemme+"
          >
            <option value="all">Alle nivåer</option>
            <option value="stemme_plus">Stemme+</option>
            <option value="free">Gratis</option>
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            aria-label="Filter status"
          >
            <option value="all">Alle statuser</option>
            <option value="active">Aktiv</option>
            <option value="deactivated">Deaktivert</option>
          </Select>
        </div>
      </div>

      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
          <span className="text-sm text-muted-foreground">{selectedCount} valgt</span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => runBulk('set_admin')}>
            Gi admin
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => runBulk('revoke_admin')}>
            Fjern admin
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => runBulk('grant_stemme_plus')}
          >
            Gi Stemme+
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => runBulk('revoke_stemme_plus')}
          >
            Fjern Stemme+
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => runBulk('deactivate')}>
            Deaktiver
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => runBulk('reactivate')}>
            Reaktiver
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? 'Ingen treff' : `${total} brukere totalt`}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm">
                <Columns3 className="size-4" />
                Kolonner
                <ChevronDown className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-44">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {COLUMN_LABELS[column.id] ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loadError && !pending ? (
          <div className="p-6" data-state="error">
            <EmptyState
              compact
              title={misconfigured ? 'Brukeradmin utilgjengelig' : 'Kunne ikke laste brukere'}
              description={loadError}
            />
          </div>
        ) : pending && users.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Laster brukere…
          </div>
        ) : users.length === 0 ? (
          <div className="p-6" data-state="empty">
            <EmptyState
              compact
              title="Ingen brukere funnet"
              description="Prøv et annet søk eller filter."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {users.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Side {pagination.pageIndex + 1} av {pageCount}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Forrige
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Neste
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={Boolean(hardDeleteTarget)}
        onClose={() => {
          setHardDeleteTarget(null);
          setHardDeleteEmail('');
          setHardDeleteError('');
        }}
        size="md"
        title="Slett bruker permanent"
        description="Dette fjerner brukeren helt og kan ikke angres. Skriv brukerens e-postadresse for å bekrefte. Permanent sletting blokkeres når brukeren har aktivt Stemme+-abonnement i Stripe."
        footer={
          <>
            <Button variant="outline" onClick={() => setHardDeleteTarget(null)}>
              Avbryt
            </Button>
            <Button variant="destructive" disabled={pending} onClick={confirmHardDelete}>
              Slett permanent
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label htmlFor="hard-delete-email" className="text-sm font-medium text-foreground">
            E-post
          </label>
          <Input
            id="hard-delete-email"
            value={hardDeleteEmail}
            onChange={(e) => setHardDeleteEmail(e.target.value)}
            autoComplete="off"
            placeholder={hardDeleteTarget?.email ?? 'epost@domene.no'}
          />
          {hardDeleteError ? <p className="text-sm text-destructive">{hardDeleteError}</p> : null}
        </div>
      </Dialog>

      <AdminToast message={message} variant={variant} />
    </div>
  );
}
