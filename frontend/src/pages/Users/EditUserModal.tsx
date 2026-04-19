import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '../../components/Modal';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Eye, EyeOff } from 'lucide-react';
import { updateUser, type User, type UserStatus } from '../../api/users';
import { getRoles, type Role } from '../../api/roles';
import { getApiErrorMessage } from '../../api/client';
import { isCanceledError, isConflictError } from '../../utils/errors';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
  onError: (msg: string) => void;
  canEdit: boolean;
  user: User | null;
}

export function EditUserModal({
  isOpen,
  onClose,
  onUpdated,
  onError,
  canEdit,
  user,
}: EditUserModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [roleId, setRoleId] = useState('');
  const initialRoleIdRef = useRef<string>('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    setName(user.name);
    setEmail(user.email);
    setStatus(user.status);
    const currentRoleId = typeof user.roleId === 'string' ? user.roleId : '';
    setRoleId(currentRoleId);
    initialRoleIdRef.current = currentRoleId;
    setPassword('');
    setShowPassword(false);
    setSubmitting(false);
    setFieldError(null);
    setConflictError(null);
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen || !canEdit || !user) return;
    const controller = new AbortController();
    setRolesLoading(true);
    setRolesError(null);

    void (async () => {
      try {
        const res = await getRoles({ page: 1, limit: 100 }, { signal: controller.signal });
        setRoles(res.data);
      } catch (err) {
        if (isCanceledError(err)) return;
        setRoles([]);
        setRolesError(getApiErrorMessage(err, 'Failed to load roles.'));
      } finally {
        setRolesLoading(false);
      }
    })();

    return () => controller.abort();
  }, [canEdit, isOpen, user]);

  const onSubmit = useCallback(async () => {
    if (!canEdit || submitting || !user) return;
    setFieldError(null);
    setConflictError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail) {
      setFieldError('Name and email are required.');
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setFieldError('Please enter a valid email address.');
      return;
    }

    const trimmedPassword = password.trim();
    if (trimmedPassword && trimmedPassword.length < 8) {
      setFieldError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await updateUser(user.id, {
        name: trimmedName,
        email: trimmedEmail,
        status,
        ...(roleId && roleId !== initialRoleIdRef.current ? { roleId } : {}),
        ...(trimmedPassword ? { password: trimmedPassword } : {}),
      });
      await onUpdated();
    } catch (err) {
      if (isConflictError(err)) {
        setConflictError('Email already exists.');
      } else {
        onError(getApiErrorMessage(err, 'Failed to update user.'));
      }
    } finally {
      setSubmitting(false);
    }
  }, [canEdit, email, name, onError, onUpdated, password, roleId, status, submitting, user]);

  return (
    <Modal title="Edit user" isOpen={isOpen} onClose={onClose}>
      {!user || !canEdit ? (
        <div className="space-y-1 text-sm text-slate-500">
          {!user ? <p>No user selected.</p> : null}
          {!canEdit ? <p>Requires users.write or users.edit.</p> : null}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            disabled={!canEdit || submitting || !user}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            disabled={!canEdit || submitting || !user}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as UserStatus)}
            disabled={!canEdit || submitting || !user}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">ACTIVE</SelectItem>
              <SelectItem value="INACTIVE">INACTIVE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Role</Label>
          <Select
            value={roleId ? roleId : '__keep_current__'}
            onValueChange={(value) => setRoleId(value === '__keep_current__' ? '' : value)}
            disabled={!canEdit || submitting || !user || rolesLoading}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__keep_current__">
                {user?.roleName ? `Keep current role (${user.roleName})` : 'Select role'}
              </SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {rolesError ? <p className="text-xs text-slate-500">{rolesError}</p> : null}
        </div>

        <div className="space-y-2">
          <Label>Password (optional)</Label>
          <div className="relative">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              disabled={!canEdit || submitting || !user}
              className="h-10 pr-10"
              autoComplete="new-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              onClick={() => setShowPassword((v) => !v)}
              disabled={!canEdit || submitting || !user}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {fieldError || conflictError ? (
        <div className="space-y-3">
          {fieldError ? (
            <Alert variant="destructive">
              <AlertDescription>{fieldError}</AlertDescription>
            </Alert>
          ) : null}
          {conflictError ? (
            <Alert variant="destructive">
              <AlertDescription>{conflictError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void onSubmit()}
          disabled={!canEdit || submitting || !user}
        >
          {submitting ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </Modal>
  );
}
