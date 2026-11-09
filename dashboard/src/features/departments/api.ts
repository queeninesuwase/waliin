import { apiFetch } from "@/lib/api/client";

const DEPARTMENTS_PATH = "/equipment/departments";

export const MAX_DEPARTMENT_NAME = 100;

export interface Department {
  department_id: string;
  department_name: string;
  description?: string | null;
  responsible_engineer_id?: string | null;
  responsible_engineer_role?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export function listDepartments() {
  return apiFetch<Department[]>(DEPARTMENTS_PATH);
}

export interface CreateDepartmentInput {
  department_name: string;
  description?: string;
}

export function createDepartment(input: CreateDepartmentInput) {
  return apiFetch<Department>(DEPARTMENTS_PATH, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function sortDepartments(departments: Department[]) {
  return departments
    .filter((department) => department.is_active !== false)
    .sort((a, b) => a.department_name.localeCompare(b.department_name));
}

export function departmentErrorMessage(status: number) {
  if (status === 0) return "Cannot reach the server. Check your connection.";
  if (status === 403) return "Only the health manager can add departments.";
  if (status === 409) return "A department with this name already exists.";
  if (status === 422) return "Check the department name and try again.";
  return "Could not add the department. Try again.";
}

export function checkDepartmentName(value: string) {
  const name = value.trim();
  if (!name) return "Enter the department name.";
  if (name.length > MAX_DEPARTMENT_NAME) {
    return `Use at most ${MAX_DEPARTMENT_NAME} characters.`;
  }
  return true;
}
