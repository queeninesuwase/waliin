"use client";

import Image from "next/image";

import { useProfilePhoto } from "@/lib/useProfilePhoto";

export function initialsOf(fullName: string | null, email: string) {
  const source = fullName?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source[0];
  return (letters ?? "?").toUpperCase();
}

type ProfileAvatarProps = {
  userId: string;
  fullName: string | null;
  email: string;
  className?: string;
};

export default function ProfileAvatar({
  userId,
  fullName,
  email,
  className = "h-10 w-10 text-sm",
}: ProfileAvatarProps) {
  const photo = useProfilePhoto(userId);

  if (photo) {
    return (
      <Image
        src={photo}
        alt=""
        aria-hidden="true"
        width={256}
        height={256}
        unoptimized
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-[#650d2f] font-semibold text-white ${className}`}
    >
      {initialsOf(fullName, email)}
    </span>
  );
}
