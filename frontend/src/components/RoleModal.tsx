import { useCallback, useEffect, useState } from "react";
import Modal from "./Modal";
import { createRole, updateRole, type Role } from "../api/roles";
import { getApiErrorMessage } from "../api/client";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

function isConflictError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 409;
}

function isNotFoundError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 404;
}

export default function RoleModal(props: {
  open: boolean;
  mode: "create" | "edit";
  initialRole?: Role | null;
  canWrite: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  const { open, mode, initialRole, canWrite, onClose, onSuccess, onError } =
    props;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && initialRole) {
      setName(initialRole.name ?? "");
      setDescription(initialRole.description ?? "");
    } else {
      setName("");
      setDescription("");
    }

    setSubmitting(false);
    setFieldError(null);
    setConflictError(null);
    setNotFoundError(null);
  }, [open, mode, initialRole]);

  const onSubmit = useCallback(async () => {
    if (!canWrite || submitting) return;

    setFieldError(null);
    setConflictError(null);
    setNotFoundError(null);

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      setFieldError("Role name is required.");
      return;
    }
    if (trimmedName.length < 2) {
      setFieldError("Role name must be at least 2 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        await createRole({
          name: trimmedName,
          ...(trimmedDescription ? { description: trimmedDescription } : {}),
        });
      } else {
        if (!initialRole) {
          setFieldError("No role selected.");
          return;
        }

        await updateRole(initialRole.id, {
          name: trimmedName,
          ...(trimmedDescription ? { description: trimmedDescription } : {}),
        });
      }

      await onSuccess();
    } catch (err) {
      if (isConflictError(err)) {
        setConflictError("Role name already exists.");
      } else if (mode === "edit" && isNotFoundError(err)) {
        setNotFoundError("Role not found.");
      } else {
        onError(
          getApiErrorMessage(
            err,
            mode === "create"
              ? "Failed to create role."
              : "Failed to update role.",
          ),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    canWrite,
    description,
    initialRole,
    mode,
    name,
    onError,
    onSuccess,
    submitting,
  ]);

  const title = mode === "create" ? "Create role" : "Edit role";

  return (
    <Modal title={title} isOpen={open} onClose={onClose}>
      {!canWrite ? (
        <p className="text-sm text-slate-500">Requires roles.write.</p>
      ) : null}
      {mode === "edit" && !initialRole ? (
        <p className="text-sm text-slate-500">No role selected.</p>
      ) : null}

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            disabled={
              !canWrite || submitting || (mode === "edit" && !initialRole)
            }
            placeholder="e.g. ADMIN"
          />
        </div>

        <div className="grid gap-1.5">
          <Label>Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            type="text"
            disabled={
              !canWrite || submitting || (mode === "edit" && !initialRole)
            }
            placeholder="Optional"
          />
        </div>
      </div>

      {fieldError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{fieldError}</AlertDescription>
        </Alert>
      ) : null}
      {conflictError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{conflictError}</AlertDescription>
        </Alert>
      ) : null}
      {notFoundError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{notFoundError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void onSubmit()}
          disabled={
            !canWrite || submitting || (mode === "edit" && !initialRole)
          }
        >
          {submitting
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create"
              : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
