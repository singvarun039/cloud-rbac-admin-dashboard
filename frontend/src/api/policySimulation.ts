import { api, getApiErrorMessage } from "./client";
import { unwrapData } from "../types/api";

export type PolicySimulationResponse = {
  role: {
    id: string;
    name: string;
    description: string | null;
  };
  currentPermissionKeys: string[];
  proposedPermissionKeys: string[];
  addedPermissionKeys: string[];
  removedPermissionKeys: string[];
  impacts: {
    losingAccess: Array<{
      kind: "page" | "api";
      key: string;
      label: string;
      description: string;
      requiredAnyOf: string[];
    }>;
    gainingAccess: Array<{
      kind: "page" | "api";
      key: string;
      label: string;
      description: string;
      requiredAnyOf: string[];
    }>;
    unchangedAccessible: Array<{
      kind: "page" | "api";
      key: string;
      label: string;
      description: string;
      requiredAnyOf: string[];
    }>;
  };
  summary: string;
};

// Simulates the impact of a role permission change before saving it.
export async function simulateRolePolicyChange(input: {
  roleId: string;
  permissionIds: string[];
}): Promise<PolicySimulationResponse> {
  try {
    const res = await api.post("/api/ai/policy-simulation", input);
    const unwrapped = unwrapData<PolicySimulationResponse>(res.data);
    if (unwrapped) return unwrapped;
    return res.data as PolicySimulationResponse;
  } catch (err) {
    throw new Error(
      getApiErrorMessage(err, "Failed to simulate policy impact."),
    );
  }
}
