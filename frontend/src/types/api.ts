export type ApiEnvelope<T> = {
  data?: T;
  message?: string;
  error?: unknown;
  [key: string]: unknown;
};

// Extracts the data payload from a loose API envelope shape.
export function unwrapData<T>(envelope: unknown): T | undefined {
  if (envelope && typeof envelope === "object" && "data" in envelope) {
    return (envelope as { data?: T }).data;
  }
  return undefined;
}
