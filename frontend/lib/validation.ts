const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function checkEmail(value: string) {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (email.length > 255 || !EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address, like name@hospital.et.";
  }
  return true;
}

export function checkPassword(value: string) {
  return value ? true : "Enter your password.";
}

export const MIN_PASSWORD_LENGTH = 12;

export function checkNewPassword(value: string) {
  if (!value) return "Enter a new password.";
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return true;
}

export function checkConfirmPassword(value: string, password: string) {
  if (!value) return "Enter the password again.";
  return value === password ? true : "The passwords do not match.";
}

export function checkFullName(value: string) {
  const name = value.trim();
  if (!name) return "Enter your full name.";
  if (name.length > 120) return "Use at most 120 characters.";
  return true;
}

export function checkCode(value: string) {
  const code = value.trim();
  if (!code) return "Enter the 6-digit code.";
  return /^\d{6}$/.test(code) ? true : "The code has 6 digits.";
}
