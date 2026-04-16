import { z } from "zod";

export const AiAssistantBodySchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(5, "Prompt must be at least 5 characters.")
    .max(1500, "Prompt must be 1500 characters or fewer."),
});
