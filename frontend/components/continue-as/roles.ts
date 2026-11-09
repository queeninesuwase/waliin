export type AppRole = "clinical_staff" | "biomedical_engineer";

export type RoleOption = {
  role: AppRole;
  title: string;
  text: string;
};

export const ROLE_OPTIONS: RoleOption[] = [
  {
    role: "clinical_staff",
    title: "Clinical staff",
    text: "Doctors, nurses and midwives. Report faults, follow their status and request equipment.",
  },
  {
    role: "biomedical_engineer",
    title: "Biomedical engineer",
    text: "Inspect, repair and test machines, and return them to service.",
  },
];

export function loginPathFor(role: AppRole) {
  return `/login?as=${role}`;
}

export const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "";
