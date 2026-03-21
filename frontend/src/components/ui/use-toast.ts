import { toast } from "sonner";

export { toast };

// Returns the shared toast API.
export function useToast() {
  return { toast };
}
