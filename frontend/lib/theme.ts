export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "waliin-theme";
const THEME_EVENT = "waliin-theme-change";

export const THEMES: { value: Theme; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Cream background" },
  { value: "dark", label: "Dark", hint: "Easier on the eyes at night" },
  { value: "system", label: "System", hint: "Follow this device" },
];

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function readTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    return isTheme(saved) ? saved : "light";
  } catch {
    return "light";
  }
}

export function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(theme: Theme, systemDark: boolean) {
  if (theme === "system") return systemDark ? "dark" : "light";
  return theme;
}

export function applyTheme(theme: Theme) {
  const dark = resolveTheme(theme, prefersDark()) === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

export function saveTheme(theme: Theme) {
  storeTheme(theme);
  applyTheme(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeTheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    applyTheme(readTheme());
    onChange();
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onSystem);
  media.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onSystem);
    media.removeEventListener("change", onSystem);
  };
}

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";}catch(_){}})();`;
