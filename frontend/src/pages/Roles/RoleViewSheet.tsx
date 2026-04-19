import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { DetailsSheet } from "../../components/DetailsSheet";
import type { Role } from "../../api/roles";

export function RoleViewSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewRole: Role | null;
}) {
  const { open, onOpenChange, viewRole } = props;
  return (
    <DetailsSheet
      open={open}
      onOpenChange={(o) => { onOpenChange(o); }}
      title="Role details"
      description={viewRole ? viewRole.name : undefined}
    >
      {!viewRole ? (
        <div className="text-sm text-slate-500">No role selected.</div>
      ) : (
        <div className="space-y-4">
          <div><Label>Name</Label><div className="text-sm">{viewRole.name}</div></div>
          <div><Label>Description</Label><div className="text-sm">{viewRole.description || "—"}</div></div>
          <div>
            <Label>Permissions</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {Array.isArray(viewRole.permissions) && viewRole.permissions.length > 0
                ? viewRole.permissions.map((p) => (
                  <Badge key={typeof p === "string" ? p : p.id} variant="secondary">
                    {typeof p === "string" ? p : p.key}
                  </Badge>
                ))
                : (
                  <div className="text-sm text-slate-500">
                    {typeof viewRole.permissionCount === "number" ? `${viewRole.permissionCount} permissions (load role for details)` : "—"}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </DetailsSheet>
  );
}
