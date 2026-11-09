import { checkEmail } from "@/features/auth/validation";

export function checkInviteEmail(value: string) {
  return checkEmail(value) === true
    ? true
    : value.trim()
      ? "Enter a valid email address, like name@hospital.et."
      : "Enter the user's email address.";
}

export function checkRole(value: string) {
  return value === "clinical_staff" || value === "biomedical_engineer"
    ? true
    : "Choose a user type.";
}

export function checkDepartment(value: string) {
  return value ? true : "Choose a department.";
}
