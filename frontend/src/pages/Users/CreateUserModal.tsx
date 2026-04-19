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
import { createUser, type UserStatus } from '../../api/users';
import { getRoles, type Role } from '../../api/roles';
import { getApiErrorMessage } from '../../api/client';
import { isCanceledError, isConflictError } from '../../utils/errors';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (msg: string) => void;
  canWrite: boolean;
}

export function CreateUserModal({
  isOpen,
  onClose,
  onCreated,
  onError,
  canWrite,
}: CreateUserModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [roleId, setRoleId] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [systemDefaultRoleName, setSystemDefaultRoleName] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setStatus('ACTIVE');
    setRoleId('');
    setSubmitting(false);
    setFieldError(null);
    setConflictError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !canWrite) return;
    const controller = new AbortController();
    setRolesLoading(true);
    setRolesError(null);

    void (async () => {
      try {
        const res = await getRoles({ page: 1, limit: 100 }, { signal: controller.signal });
        const items = res.data;
        setRoles(items);
        const preferred =
          items.find((r) => r.name.trim().toLowerCase() === 'viewer') ??
          items.find((r) => r.name.trim().toLowerCase() === 'user') ??
          null;
        setSystemDefaultRoleName(preferred?.name ?? items[0]?.name ?? null);
      } catch (err) {
        if (isCanceledError(err)) return;
        setRoles([]);
        setSystemDefaultRoleName(null);
        setRolesError(getApiErrorMessage(err, 'Failed to load roles.'));
      } finally {
        setRolesLoading(false);
      }
    })();

    return () => controller.abort();
  }, [canWrite, isOpen]);

  const onSubmit = useCallback(async () => {
    if (!canWrite || submitting) return;
    setFieldError(null);
    setConflictError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password) {
      setFieldError('Name, email, and password are required.');
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setFieldError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setFieldError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await createUser({
        name: trimmedName,
        email: trimmedEmail,
        password,
        status,
        ...(roleId ? { roleId } : {}),
      });
      await onCreated();
    } catch (err) {
      if (isConflictError(err)) {
        setConflictError('Email already exists.');
      } else {
        onError(getApiErrorMessage(err, 'Failed to create user.'));
      }
    } finally {
      setSubmitting(false);
    }
  }, [canWrite, email, name, onCreated, onError, password, roleId, status, submitting]);

  return (
    <Modal title="Create user" isOpen={isOpen} onClose={onClose}>
      {!canWrite ? (
        <div className="space-y-1 text-sm text-slate-500">
          <p>Requires users.write.</p>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            disabled={!canWrite || submitting}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            disabled={!canWrite || submitting}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label>Password</Label>
          <div className="relative">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              disabled={!canWrite || submitting}
              className="h-10 pr-10"
              autoComplete="new-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              onClick={() => setShowPassword((v) => !v)}
              disabled={!canWrite || submitting}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as UserStatus)}
            disabled={!canWrite || submitting}
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
            value={roleId ? roleId : '__default__'}
            onValueChange={(value) => setRoleId(value === '__default__' ? '' : value)}
            disabled={!canWrite || submitting || rolesLoading}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">
                {systemDefaultRoleName
                  ? `System default (${systemDefaultRoleName})`
                  : 'System default'}
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
        <Button type="button" onClick={() => void onSubmit()} disabled={!canWrite || submitting}>
          {submitting ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </Modal>
  );
}
