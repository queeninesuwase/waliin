export function mfaRedirect(nextStep: string | null | undefined) {
  if (nextStep === "mfa_setup") return "/login/setup-mfa";
  if (nextStep === "mfa_verify") return "/login/verify";
  return null;
}

export function engineerRedirect(
  role: string | null | undefined,
  nextStep?: string | null,
) {
  if (role === "biomedical_engineer") return mfaRedirect(nextStep);
  if (role === "clinical_staff") return mfaRedirect(nextStep) ?? "/home";
  return "/login?as=biomedical_engineer";
}

export function clinicalRedirect(
  role: string | null | undefined,
  nextStep?: string | null,
) {
  if (role === "clinical_staff") return mfaRedirect(nextStep);
  if (role === "biomedical_engineer") {
    return mfaRedirect(nextStep) ?? "/biomedical-engineer/dashboard";
  }
  if (!role) return "/login?as=clinical_staff";
  return "/continue-as";
}
