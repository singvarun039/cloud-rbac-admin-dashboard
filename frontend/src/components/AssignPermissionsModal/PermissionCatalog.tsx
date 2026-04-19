import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import type { Permission } from '../../api/permissions';

function getPermissionFamily(key: string): string {
  const [family] = key.split('.');
  return family || 'other';
}

interface PermissionCatalogProps {
  catalog: Permission[];
  filtered: Permission[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  selectedIds: string[];
  selectedSet: Set<string>;
  changedCount: number;
  hydratedFromKeys: boolean;
  canEditRoles: boolean;
  submitting: boolean;
  role: { id: string; name: string } | null;
  toggle: (id: string) => void;
  onSelectAllFiltered: () => void;
  onClearFiltered: () => void;
}

export function PermissionCatalog({
  catalog,
  filtered,
  loading,
  search,
  setSearch,
  selectedIds,
  selectedSet,
  changedCount,
  hydratedFromKeys,
  canEditRoles,
  submitting,
  role,
  toggle,
  onSelectAllFiltered,
  onClearFiltered,
}: PermissionCatalogProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Permission catalog</CardTitle>
            <div className="mt-1 text-sm text-slate-500">
              Filter and toggle permissions for this role.
            </div>
          </div>
          {hydratedFromKeys ? <Badge variant="secondary">Hydrated from keys</Badge> : null}
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="filter by key or description"
              type="text"
              disabled={loading || !role}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Button
              variant="outline"
              type="button"
              onClick={onSelectAllFiltered}
              disabled={loading || filtered.length === 0}
              className="h-10"
            >
              Select visible
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={onClearFiltered}
              disabled={loading || filtered.length === 0}
              className="h-10"
            >
              Clear visible
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Visible: {filtered.length}</Badge>
          <Badge variant="secondary">Selected: {selectedIds.length}</Badge>
          <Badge variant="secondary">Added since open: {changedCount}</Badge>
        </div>
        <div className="max-h-[52vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : catalog.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">No permissions found.</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No permissions match your search.
            </div>
          ) : (
            <div className="grid gap-2">
              {filtered.map((p) => {
                const checked = selectedSet.has(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${checked ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(p.id)}
                      disabled={!canEditRoles || submitting || !role}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-slate-900">{p.key}</div>
                        <Badge variant="secondary" className="text-[11px]">
                          {getPermissionFamily(p.key)}
                        </Badge>
                      </div>
                      {p.description ? (
                        <div className="mt-1 text-sm text-slate-600">{p.description}</div>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
