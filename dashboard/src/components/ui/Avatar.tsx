"use client";

import Image from "next/image";

import { useProfilePhoto } from "@/lib/useProfilePhoto";
import { initials } from "@/lib/user";

type AvatarProps = {
  userId: string;
  fullName: string | null;
  email: string;
  className?: string;
};

export default function Avatar({
  userId,
  fullName,
  email,
  className = "h-11 w-11 text-base",
}: AvatarProps) {
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
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-white ${className}`}
    >
      {initials(fullName, email)}
    </span>
  );
}
