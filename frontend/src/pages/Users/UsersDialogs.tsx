import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { buttonVariants } from '../../components/ui/button-variants';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import type { User } from '../../api/users';

export function UsersDialogs(props: {
  deactivateOpen: boolean;
  onDeactivateOpenChange: (open: boolean) => void;
  deactivateTarget: User | null;
  onConfirmDeactivate: () => void;
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  deleteTarget: User | null;
  deleteConfirmText: string;
  onDeleteConfirmTextChange: (text: string) => void;
  onConfirmDelete: () => void;
  meId: string | undefined;
}) {
  const {
    deactivateOpen,
    onDeactivateOpenChange,
    deactivateTarget,
    onConfirmDeactivate,
    deleteOpen,
    onDeleteOpenChange,
    deleteTarget,
    deleteConfirmText,
    onDeleteConfirmTextChange,
    onConfirmDelete,
    meId,
  } = props;

  return (
    <>
      <AlertDialog
        open={deactivateOpen}
        onOpenChange={(open) => {
          onDeactivateOpenChange(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget
                ? `Deactivate user "${deactivateTarget.email}"? You can re-enable later by editing status.`
                : 'Are you sure you want to deactivate this user?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className={buttonVariants({ variant: 'destructive' })}
              onClick={onConfirmDeactivate}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          onDeleteOpenChange(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will permanently delete user "${deleteTarget.email}". Type the user's email to confirm.`
                : 'This action is irreversible.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget ? (
            <div className="mt-3 space-y-2">
              <Label>Confirm email</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => onDeleteConfirmTextChange(e.target.value)}
                placeholder={deleteTarget.email}
                autoComplete="off"
              />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className={buttonVariants({ variant: 'destructive' })}
              onClick={onConfirmDelete}
              disabled={
                !deleteTarget ||
                Boolean(meId && deleteTarget?.id === meId) ||
                (deleteTarget ? deleteConfirmText.trim() !== deleteTarget.email : true)
              }
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
