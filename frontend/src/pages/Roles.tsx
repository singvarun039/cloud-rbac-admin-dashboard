import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { getRoles, type Role } from "../api/roles";
import { getApiErrorMessage } from "../api/client";
import RoleModal from "../components/RoleModal";
import AssignPermissionsModal from "../components/AssignPermissionsModal";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

function isCanceledError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === "ERR_CANCELED";
}

function NotAuthorized() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Forbidden (403)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            You don’t have permission to view roles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function permissionCountLabel(role: Role): string {
  const countFromArray = Array.isArray(role.permissions)
    ? role.permissions.length
    : null;
  const count =
    typeof countFromArray === "number"
      ? countFromArray
      : typeof role.permissionCount === "number"
        ? role.permissionCount
        : 0;
  return `${count} permissions`;
}

export default function RolesPage() {
  const { permissions } = useAuth();

  const canReadRoles = permissions.includes("roles.read");
  const canWriteRoles = permissions.includes("roles.write");
  const canReadPermissions = permissions.includes("permissions.read");

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigningRole, setAssigningRole] = useState<Role | null>(null);

  const fetchSeqRef = useRef(0);

  const fetchRoles = useCallback(
    async (opts?: { signal?: AbortSignal }) => {
      if (!canReadRoles) return;

      const seq = ++fetchSeqRef.current;
      setLoading(true);
      setError(null);

      try {
        const res = await getRoles(
          { page: 1, limit: 100, search: debouncedSearch },
          { signal: opts?.signal },
        );
        if (fetchSeqRef.current !== seq) return;
        setRoles(res.data);
      } catch (err) {
        if (isCanceledError(err)) return;
        if (fetchSeqRef.current !== seq) return;
        setError(getApiErrorMessage(err, "Failed to load roles."));
      } finally {
        if (fetchSeqRef.current === seq) setLoading(false);
      }
    },
    [canReadRoles, debouncedSearch],
  );

  useEffect(() => {
    if (!canReadRoles) return;
    const controller = new AbortController();
    void fetchRoles({ signal: controller.signal });
    return () => controller.abort();
  }, [canReadRoles, fetchRoles]);

  const onRetry = useCallback(() => {
    setSuccess(null);
    const controller = new AbortController();
    void fetchRoles({ signal: controller.signal });
  }, [fetchRoles]);

  const onOpenCreate = useCallback(() => {
    setSuccess(null);
    setCreateOpen(true);
  }, []);

  const onOpenEdit = useCallback((r: Role) => {
    setSuccess(null);
    setEditingRole(r);
    setEditOpen(true);
  }, []);

  const onCloseEdit = useCallback(() => {
    setEditOpen(false);
    setEditingRole(null);
  }, []);

  const onOpenAssign = useCallback((r: Role) => {
    setSuccess(null);
    setAssigningRole(r);
    setAssignOpen(true);
  }, []);

  const onCloseAssign = useCallback(() => {
    setAssignOpen(false);
    setAssigningRole(null);
  }, []);

  if (!canReadRoles) {
    return <NotAuthorized />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
        <p className="text-sm text-slate-600">
          Manage roles and their permissions.
        </p>
      </div>

      {success ? (
        <Alert variant="success">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <AlertDescription className="sm:pr-4">{error}</AlertDescription>
            <Button variant="outline" size="sm" type="button" onClick={onRetry}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1.5">
          <Label>Search</Label>
          <Input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
            }}
            placeholder="name or description"
            type="text"
            className="h-10"
          />
        </div>

        {canWriteRoles ? (
          <Button type="button" onClick={onOpenCreate} className="h-10">
            Create Role
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roles</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-[220px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-56" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="h-9 w-36" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : roles.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No roles found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-[220px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      {r.description ? (
                        r.description
                      ) : (
                        <span className="text-sm text-slate-500">—</span>
                      )}
                    </TableCell>
                    <TableCell>{permissionCountLabel(r)}</TableCell>
                    <TableCell className="text-right">
                      {canWriteRoles ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => onOpenEdit(r)}
                            className="h-9 min-w-20"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            onClick={() => onOpenAssign(r)}
                            className="h-9 min-w-36"
                          >
                            Assign Permissions
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RoleModal
        open={createOpen}
        mode="create"
        canWrite={canWriteRoles}
        onClose={() => setCreateOpen(false)}
        onSuccess={async () => {
          setCreateOpen(false);
          await fetchRoles();
          setSuccess("Role created.");
        }}
        onError={(msg) => setError(msg)}
      />

      <RoleModal
        open={editOpen}
        mode="edit"
        initialRole={editingRole}
        canWrite={canWriteRoles}
        onClose={onCloseEdit}
        onSuccess={async () => {
          onCloseEdit();
          await fetchRoles();
          setSuccess("Role updated.");
        }}
        onError={(msg) => setError(msg)}
      />

      <AssignPermissionsModal
        open={assignOpen}
        role={assigningRole}
        canWriteRoles={canWriteRoles}
        canReadPermissions={canReadPermissions}
        onClose={onCloseAssign}
        onSuccess={async () => {
          onCloseAssign();
          await fetchRoles();
          setSuccess("Role permissions updated.");
        }}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}
