"use client";

import { useSyncExternalStore } from "react";

import { readTheme, saveTheme, subscribeTheme, type Theme } from "./theme";

function serverTheme(): Theme {
  return "light";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);
  return [theme, saveTheme] as const;
}

function readDark() {
  return document.documentElement.classList.contains("dark");
}

function serverDark() {
  return false;
}

export function useIsDark() {
  return useSyncExternalStore(subscribeTheme, readDark, serverDark);
}
