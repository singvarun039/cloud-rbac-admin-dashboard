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
import type { User, UserStatus } from '../../api/users';
import { useEditUserForm } from './useEditUserForm';

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
  const f = useEditUserForm({ isOpen, user, canEdit, onUpdated, onError });

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
            value={f.name}
            onChange={(e) => f.setName(e.target.value)}
            type="text"
            disabled={!canEdit || f.submitting || !user}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            value={f.email}
            onChange={(e) => f.setEmail(e.target.value)}
            type="email"
            disabled={!canEdit || f.submitting || !user}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={f.status}
            onValueChange={(value) => f.setStatus(value as UserStatus)}
            disabled={!canEdit || f.submitting || !user}
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
            value={f.roleId ? f.roleId : '__keep_current__'}
            onValueChange={(value) => f.setRoleId(value === '__keep_current__' ? '' : value)}
            disabled={!canEdit || f.submitting || !user || f.rolesLoading}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__keep_current__">
                {user?.roleName ? `Keep current role (${user.roleName})` : 'Select role'}
              </SelectItem>
              {f.roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {f.rolesError ? <p className="text-xs text-slate-500">{f.rolesError}</p> : null}
        </div>

        <div className="space-y-2">
          <Label>Password (optional)</Label>
          <div className="relative">
            <Input
              value={f.password}
              onChange={(e) => f.setPassword(e.target.value)}
              type={f.showPassword ? 'text' : 'password'}
              disabled={!canEdit || f.submitting || !user}
              className="h-10 pr-10"
              autoComplete="new-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              onClick={() => f.setShowPassword((v) => !v)}
              disabled={!canEdit || f.submitting || !user}
              aria-label={f.showPassword ? 'Hide password' : 'Show password'}
            >
              {f.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {f.fieldError || f.conflictError ? (
        <div className="space-y-3">
          {f.fieldError ? (
            <Alert variant="destructive">
              <AlertDescription>{f.fieldError}</AlertDescription>
            </Alert>
          ) : null}
          {f.conflictError ? (
            <Alert variant="destructive">
              <AlertDescription>{f.conflictError}</AlertDescription>
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
          onClick={() => void f.onSubmit()}
          disabled={!canEdit || f.submitting || !user}
        >
          {f.submitting ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </Modal>
  );
}
