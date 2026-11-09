import { apiFetch, ApiError } from "./client";

// -----------------------------------------------------------------------------
// Department
// -----------------------------------------------------------------------------

export interface Department {
  department_id: string;
  department_name: string;
  is_active: boolean;
}

// -----------------------------------------------------------------------------
// Equipment
// -----------------------------------------------------------------------------

export interface EquipmentCreateRequest {
  manufacturer: string;
  model_name: string;
  model_number?: string | null;
  equipment_category: string;
  department_id: string;
  asset_tag: string;
  serial_number?: string | null;
  location: string;

  acquisition_type?:
    "donated" | "purchased" | "transferred" | "unknown" | "other";

  donor_or_supplier?: string | null;
  received_at?: string | null;

  service_status?:
    | "not_assessed"
    | "in_service"
    | "out_of_service"
    | "under_maintenance"
    | "not_installed"
    | "incomplete"
    | "retired";

  installation_status?:
    | "unknown"
    | "not_installed"
    | "partially_installed"
    | "installed"
    | "commissioned";

  warranty_start_date?: string | null;
  warranty_end_date?: string | null;
}

export interface EquipmentResponse {
  equipment_id: string;
  manufacturer: string;
  model_name: string;
  model_number: string | null;
  equipment_category: string;
  department_id: string;
  asset_tag: string;
  serial_number: string | null;
  location: string;
  registration_status: string;
  installation_status: string;
  service_status: string;
  created_at: string;
}

export interface EquipmentUpdateRequest {
  manufacturer?: string;
  model_name?: string;
  model_number?: string | null;
  equipment_category?: string;
  department_id?: string;
  asset_tag?: string;
  serial_number?: string | null;
  location?: string;

  acquisition_type?:
    "donated" | "purchased" | "transferred" | "unknown" | "other";

  donor_or_supplier?: string | null;
  received_at?: string | null;

  installation_status?:
    | "unknown"
    | "not_installed"
    | "partially_installed"
    | "installed"
    | "commissioned";

  service_status?:
    | "not_assessed"
    | "in_service"
    | "out_of_service"
    | "under_maintenance"
    | "not_installed"
    | "incomplete"
    | "retired";

  warranty_start_date?: string | null;
  warranty_end_date?: string | null;
}

// -----------------------------------------------------------------------------
// CSV import
// -----------------------------------------------------------------------------

export interface CsvImportError {
  row_number: number;
  reason: string;
}

export interface CsvImportedEquipment {
  equipment_id: string;
  asset_tag: string;
  manufacturer: string;
  model_name: string;
}

export interface CsvImportResponse {
  imported_count: number;
  errors: CsvImportError[];
  imported_equipment: CsvImportedEquipment[];
}

export function importEquipmentCsv(file: File): Promise<CsvImportResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return uploadCsv(formData);
}

async function uploadCsv(formData: FormData): Promise<CsvImportResponse> {
  let response: Response;

  try {
    response = await fetch("/api/equipment/import-csv", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection.");
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;

    throw new ApiError(
      response.status,
      typeof detail === "string"
        ? detail
        : "Unable to import CSV. Please try again.",
    );
  }

  return data as CsvImportResponse;
}

// -----------------------------------------------------------------------------
// Equipment API functions
// -----------------------------------------------------------------------------

export function getDepartments(): Promise<Department[]> {
  return apiFetch<Department[]>("/equipment/departments");
}

export function registerEquipment(
  payload: EquipmentCreateRequest,
): Promise<EquipmentResponse> {
  return apiFetch<EquipmentResponse>("/equipment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMyEquipment(): Promise<EquipmentResponse[]> {
  return apiFetch<EquipmentResponse[]>("/equipment/mine");
}

export function updateEquipment(
  equipmentId: string,
  payload: EquipmentUpdateRequest,
): Promise<EquipmentResponse> {
  return apiFetch<EquipmentResponse>(
    `/equipment/${encodeURIComponent(equipmentId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function resubmitEquipment(
  equipmentId: string,
  corrections: EquipmentUpdateRequest = {},
): Promise<EquipmentResponse> {
  return apiFetch<EquipmentResponse>(
    `/equipment/${encodeURIComponent(equipmentId)}/resubmit`,
    {
      method: "POST",
      body: JSON.stringify(corrections),
    },
  );
}

// -----------------------------------------------------------------------------
// Equipment documents
// -----------------------------------------------------------------------------

export type EquipmentDocumentType =
  | "manual"
  | "warranty"
  | "donation_letter"
  | "delivery_note"
  | "installation_report"
  | "calibration_certificate"
  | "photo"
  | "other";

export interface EquipmentDocumentResponse {
  document_id: string;
  equipment_id: string;
  document_type: EquipmentDocumentType;
  document_name: string;
  storage_key: string;
  uploaded_by: string;
  uploaded_at: string;
}

export async function uploadEquipmentDocument(
  equipmentId: string,
  file: File,
  docType: EquipmentDocumentType = "other",
): Promise<EquipmentDocumentResponse> {
  const formData = new FormData();

  formData.append("doc_type", docType);
  formData.append("doc_name", file.name);
  formData.append("file", file);

  let response: Response;

  try {
    response = await fetch(
      `/api/equipment/${encodeURIComponent(equipmentId)}/documents`,
      {
        method: "POST",
        credentials: "include",
        body: formData,
      },
    );
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection.");
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;

    throw new ApiError(
      response.status,
      typeof detail === "string"
        ? detail
        : "Unable to upload document. Please try again.",
    );
  }

  return data as EquipmentDocumentResponse;
}
