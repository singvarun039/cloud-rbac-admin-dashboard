import { api, getApiErrorMessage } from "./client";
import { unwrapData } from "../types/api";

export type AdminAssistantResponse = {
  answer: string;
  model: string;
  sources: Array<{
    key: string;
    label: string;
    description: string;
  }>;
};

// Sends a dashboard assistant question to the backend AI route.
export async function askAdminAssistant(
  prompt: string,
  options?: { signal?: AbortSignal },
): Promise<AdminAssistantResponse> {
  try {
    const res = await api.post(
      "/api/ai/assistant",
      { prompt },
      { signal: options?.signal },
    );

    const unwrapped = unwrapData<AdminAssistantResponse>(res.data);
    if (unwrapped) return unwrapped;

    return res.data as AdminAssistantResponse;
  } catch (err) {
    throw new Error(
      getApiErrorMessage(err, "Failed to get an AI assistant response."),
    );
  }
}
