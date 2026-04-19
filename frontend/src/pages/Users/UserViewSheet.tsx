import { Separator } from '../../components/ui/separator';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { DetailsSheet } from '../../components/DetailsSheet';
import { formatDate } from '../../utils/format';
import type { User } from '../../api/users';

export function UserViewSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewUser: User | null;
  roleTextForUser: (u: User) => { text: string; title?: string };
}) {
  const { open, onOpenChange, viewUser, roleTextForUser } = props;
  return (
    <DetailsSheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
      }}
      title="User details"
      description={viewUser ? viewUser.email : undefined}
    >
      {!viewUser ? (
        <div className="text-sm text-slate-500">No user selected.</div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <div className="text-sm">{viewUser.name || '—'}</div>
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <div className="text-sm">{viewUser.email}</div>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <div>
              <Badge variant={viewUser.status === 'ACTIVE' ? 'success' : 'destructive'}>
                {viewUser.status}
              </Badge>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Role(s)</Label>
            {(() => {
              const r = roleTextForUser(viewUser);
              return (
                <div className="text-sm" title={r.title}>
                  {r.title ?? r.text}
                </div>
              );
            })()}
          </div>
          <Separator />
          <div className="space-y-1">
            <Label>Created</Label>
            <div className="text-sm">{formatDate(viewUser.createdAt)}</div>
          </div>
          <div className="space-y-1">
            <Label>Updated</Label>
            <div className="text-sm">{formatDate(viewUser.updatedAt)}</div>
          </div>
        </div>
      )}
    </DetailsSheet>
  );
}
