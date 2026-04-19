// Detects whether a request was canceled by the caller.
export function isCanceledError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === "ERR_CANCELED";
}

// Detects whether an API failure is a conflict response.
export function isConflictError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 409;
}
