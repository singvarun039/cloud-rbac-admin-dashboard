import { useCallback, useState } from 'react';
import { deleteUser, permanentlyDeleteUser, type User } from '../../api/users';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../components/ui/use-toast';

interface UseUserActionsParams {
  canWriteUsers: boolean;
  users: User[];
  page: number;
  setPage: (p: number | ((prev: number) => number)) => void;
  fetchUsers: (opts?: { page?: number }) => Promise<void>;
  setError: (msg: string | null) => void;
  setSuccess: (msg: string | null) => void;
}

export function useUserActions({
  canWriteUsers,
  users,
  page,
  setPage,
  fetchUsers,
  setError,
  setSuccess,
}: UseUserActionsParams) {
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const onDeactivateUser = useCallback(
    async (u: User) => {
      if (!canWriteUsers) return;
      setSuccess(null);
      try {
        await deleteUser(u.id);
        if (users.length === 1 && page > 1) {
          setPage((p) => Math.max(1, p - 1));
        } else {
          void fetchUsers();
        }
        setSuccess('User deactivated.');
        toast.success('User deactivated');
      } catch (err) {
        const msg = getApiErrorMessage(err, 'Failed to deactivate user.');
        setError(msg);
        toast.error('Action failed', { description: msg });
      }
    },
    [canWriteUsers, fetchUsers, page, users.length, setError, setSuccess, setPage]
  );

  const onConfirmDeactivate = useCallback(() => {
    if (!deactivateTarget) return;
    setDeactivateOpen(false);
    void onDeactivateUser(deactivateTarget);
  }, [deactivateTarget, onDeactivateUser]);

  const onConfirmDelete = useCallback(async () => {
    if (!deleteTarget || !canWriteUsers) return;
    if (deleteConfirmText.trim() !== deleteTarget.email) {
      setError(`Type ${deleteTarget.email} to confirm deletion.`);
      toast.error('Delete blocked', { description: 'Confirmation did not match.' });
      return;
    }
    try {
      await permanentlyDeleteUser(deleteTarget.id);
      setDeleteOpen(false);
      setDeleteTarget(null);
      setDeleteConfirmText('');
      setPage(1);
      await fetchUsers({ page: 1 });
      setSuccess('User deleted permanently.');
      toast.success('User deleted');
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to delete user.');
      setError(msg);
      toast.error('Action failed', { description: msg });
    }
  }, [canWriteUsers, deleteConfirmText, deleteTarget, fetchUsers, setError, setSuccess, setPage]);

  return {
    deactivateOpen,
    setDeactivateOpen,
    deactivateTarget,
    setDeactivateTarget,
    deleteOpen,
    setDeleteOpen,
    deleteTarget,
    setDeleteTarget,
    deleteConfirmText,
    setDeleteConfirmText,
    onConfirmDeactivate,
    onConfirmDelete,
  };
}
