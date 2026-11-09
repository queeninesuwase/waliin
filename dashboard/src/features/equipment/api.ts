import { apiFetch } from "@/lib/api/client";

export type EquipmentStatus = "pending" | "approved" | "returned";

export interface Equipment {
  equipment_id: string;
  manufacturer: string;
  model_name: string;
  model_number: string | null;
  equipment_category: string;
  department_id: string;
  asset_tag: string;
  serial_number: string | null;
  location: string;
  acquisition_type:
    "donated" | "purchased" | "transferred" | "unknown" | "other";
  registration_status: string;
  installation_status:
    | "unknown"
    | "not_installed"
    | "partially_installed"
    | "installed"
    | "commissioned";
  service_status:
    | "not_assessed"
    | "in_service"
    | "out_of_service"
    | "under_maintenance"
    | "not_installed"
    | "incomplete"
    | "retired";
  registered_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface EquipmentReturnInput {
  reason?: string;
}

export function listEquipment() {
  return apiFetch<Equipment[]>("/equipment");
}

export function listPendingEquipment() {
  return apiFetch<Equipment[]>("/equipment/pending");
}

export function mergeEquipment(...groups: Equipment[][]) {
  const byId = new Map<string, Equipment>();
  for (const group of groups) {
    for (const item of group) byId.set(item.equipment_id, item);
  }
  return [...byId.values()].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
}

export async function listAllEquipment() {
  const [approved, pending] = await Promise.all([
    listEquipment(),
    listPendingEquipment(),
  ]);
  return mergeEquipment(approved, pending);
}

export function getEquipment(equipmentId: string) {
  return apiFetch<Equipment>(`/equipment/${encodeURIComponent(equipmentId)}`);
}

export function approveEquipment(equipmentId: string) {
  return apiFetch<Equipment>(
    `/equipment/${encodeURIComponent(equipmentId)}/approve`,
    { method: "POST" },
  );
}

export function returnEquipment(
  equipmentId: string,
  input: EquipmentReturnInput,
) {
  return apiFetch<Equipment>(
    `/equipment/${encodeURIComponent(equipmentId)}/return`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
