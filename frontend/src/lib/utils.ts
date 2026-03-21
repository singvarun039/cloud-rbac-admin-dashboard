import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Merges conditional class names into a single Tailwind-safe string.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
