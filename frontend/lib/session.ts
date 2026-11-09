import { http } from "./http";

export type CurrentUser = {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  department_id?: string | null;
  next_step?: string;
};

export const fetchMe = () => http<CurrentUser>("/auth/me");

export async function signOut() {
  try {
    await http<void>("/auth/logout", { method: "POST" });
  } catch {
    return;
  }
}

export function prettyRole(role: string) {
  const text = role.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function greeting(now: Date = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
