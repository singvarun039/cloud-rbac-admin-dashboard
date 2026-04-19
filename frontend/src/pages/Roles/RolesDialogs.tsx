import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { buttonVariants } from "../../components/ui/button-variants";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import type { Role } from "../../api/roles";

export function RolesDialogs(props: {
  assignConfirmOpen: boolean;
  onAssignConfirmOpenChange: (open: boolean) => void;
  assignConfirmRole: Role | null;
  onConfirmAssign: (role: Role) => void;
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  deleteRole: Role | null;
  deleteConfirmText: string;
  onDeleteConfirmTextChange: (text: string) => void;
  onConfirmDelete: () => void;
  deleting: boolean;
}) {
  const {
    assignConfirmOpen, onAssignConfirmOpenChange, assignConfirmRole, onConfirmAssign,
    deleteOpen, onDeleteOpenChange, deleteRole, deleteConfirmText,
    onDeleteConfirmTextChange, onConfirmDelete, deleting,
  } = props;

  return (
    <>
      <AlertDialog open={assignConfirmOpen} onOpenChange={(open) => { onAssignConfirmOpenChange(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign permissions?</AlertDialogTitle>
            <AlertDialogDescription>
              {assignConfirmRole ? `Open permission assignment for role "${assignConfirmRole.name}"?` : "Open permission assignment for this role?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" className={buttonVariants({ variant: "default" })} onClick={() => { if (assignConfirmRole) onConfirmAssign(assignConfirmRole); }}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { onDeleteOpenChange(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRole ? `Type "${deleteRole.name}" to confirm deletion of role "${deleteRole.name}".` : "This action is irreversible."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteRole ? (
            <div className="mt-3 space-y-2">
              <Label>Confirm role name</Label>
              <Input value={deleteConfirmText} onChange={(e) => onDeleteConfirmTextChange(e.target.value)} placeholder={deleteRole.name} autoComplete="off" />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" className={buttonVariants({ variant: "destructive" })} disabled={!deleteRole || deleteConfirmText.trim() !== deleteRole.name || deleting} onClick={onConfirmDelete}>
              {deleting ? "Deleting..." : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
