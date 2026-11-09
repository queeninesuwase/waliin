import type { UserRole } from "@/types/enums";

const ROLE_LABELS: Record<UserRole, string> = {
  health_manager: "Health Manager",
  biomedical_engineer: "Biomedical Engineer",
  clinical_staff: "Clinical Staff",
};

export function roleLabel(role: UserRole) {
  return ROLE_LABELS[role] ?? role;
}

export function initials(fullName: string | null, email: string) {
  const source = fullName?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source[0];
  return (letters ?? "?").toUpperCase();
}

export function displayName(fullName: string | null, email: string) {
  return fullName?.trim() || email;
}
