import type { UserRole } from "./enums";

export interface User {
  user_id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  department_id: string | null;
}
