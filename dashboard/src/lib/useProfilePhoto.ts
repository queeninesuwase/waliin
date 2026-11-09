"use client";

import { useCallback, useSyncExternalStore } from "react";

import { readPhoto, subscribePhoto } from "@/lib/profilePhoto";

function noPhoto() {
  return null;
}

export function useProfilePhoto(userId: string) {
  const read = useCallback(() => readPhoto(userId), [userId]);
  return useSyncExternalStore(subscribePhoto, read, noPhoto);
}
