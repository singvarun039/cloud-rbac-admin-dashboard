import { useCallback, useEffect, useRef, useState } from 'react';
import { updateUser, type User, type UserStatus } from '../../api/users';
import { getRoles, type Role } from '../../api/roles';
import { getApiErrorMessage } from '../../api/client';
import { isCanceledError, isConflictError } from '../../utils/errors';

interface UseEditUserFormParams {
  isOpen: boolean;
  user: User | null;
  canEdit: boolean;
  onUpdated: () => Promise<void>;
  onError: (msg: string) => void;
}

export function useEditUserForm({
  isOpen,
  user,
  canEdit,
  onUpdated,
  onError,
}: UseEditUserFormParams) {
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

  return {
    name,
    setName,
    email,
    setEmail,
    status,
    setStatus,
    roleId,
    setRoleId,
    roles,
    rolesLoading,
    rolesError,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    submitting,
    fieldError,
    conflictError,
    onSubmit,
  };
}
