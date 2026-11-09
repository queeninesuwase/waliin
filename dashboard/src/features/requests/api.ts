import { apiFetch } from "@/lib/api/client";

export type RequestItem = {
  item_id?: string;
  request_id?: string;
  item_name: string;
  part_number?: string | null;
  specification?: string | null;
  unit?: string | null;
  quantity_requested: number;
  quantity_approved?: number | null;
  quantity_fulfilled?: number | null;
};

export type ResourceRequest = {
  id: string;
  request_id: string;
  request_number?: string;
  requested_by: string;
  requester_name?: string;
  related_fault_id?: string | null;
  request_type: string;
  justification: string;
  status?: string | null;
  decision_by?: string | null;
  decision_reason?: string | null;
  requested_at?: string | null;
  decided_at?: string | null;
  resolved_at?: string | null;
  items?: RequestItem[] | null;
};

export type RequestDecisionPayload = {
  approval_status: "Approved" | "Rejected" | "Returned";
  manager_id?: string;
  decision_reason?: string;
};

export async function getRequests(): Promise<ResourceRequest[]> {
  const data = await apiFetch<ResourceRequest[]>("/requests");
  return Array.isArray(data) ? data : [];
}

export async function getRequest(requestId: string): Promise<ResourceRequest> {
  return apiFetch<ResourceRequest>(
    `/requests/${encodeURIComponent(requestId)}`,
  );
}

export async function decideRequest(
  requestId: string,
  payload: RequestDecisionPayload,
): Promise<{ message: string }> {
  const me = await apiFetch<{ user_id: string; role: string }>("/auth/me");
  return apiFetch<{ message: string }>(
    `/requests/${encodeURIComponent(requestId)}/decide`,
    {
      method: "POST",
      headers: { "x-user-role": me.role, "user-id": me.user_id },
      body: JSON.stringify({ ...payload, manager_id: me.user_id }),
    },
  );
}
