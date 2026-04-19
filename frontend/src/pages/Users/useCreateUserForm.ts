import { useCallback, useEffect, useState } from 'react';
import { createUser, type UserStatus } from '../../api/users';
import { getRoles, type Role } from '../../api/roles';
import { getApiErrorMessage } from '../../api/client';
import { isCanceledError, isConflictError } from '../../utils/errors';

interface UseCreateUserFormParams {
  isOpen: boolean;
  canWrite: boolean;
  onCreated: () => Promise<void>;
  onError: (msg: string) => void;
}

export function useCreateUserForm({ isOpen, canWrite, onCreated, onError }: UseCreateUserFormParams) {
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

  return {
    name, setName,
    email, setEmail,
    password, setPassword,
    status, setStatus,
    roleId, setRoleId,
    roles, rolesLoading, rolesError,
    systemDefaultRoleName,
    showPassword, setShowPassword,
    submitting, fieldError, conflictError,
    onSubmit,
  };
}
