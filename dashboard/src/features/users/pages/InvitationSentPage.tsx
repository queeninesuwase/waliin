"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import IconCircle from "@/features/auth/components/IconCircle";
import { MailIcon } from "@/features/auth/components/icons";

export default function InvitationSentPage() {
  const email = useSearchParams().get("email");

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="flex w-full max-w-2xl flex-col items-center text-center">
        <IconCircle>
          <MailIcon className="h-8 w-8" />
        </IconCircle>
        <h1 className="mt-8 text-4xl font-bold text-foreground">
          Invitation sent successfully
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          An invitation has been sent to{" "}
          <span className="font-medium text-foreground">
            {email || "the user"}
          </span>
          . The user can now set up their account and join your facility.
        </p>
        <div className="mt-10 flex w-full max-w-lg flex-col gap-4">
          <Link
            href="/users/invite"
            className="flex h-14 items-center justify-center rounded-lg bg-gold text-base font-semibold text-white hover:opacity-90"
          >
            Invite another user
          </Link>
          <Link
            href="/users"
            className="flex h-14 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-semibold text-brand hover:bg-cream"
          >
            Back to users
          </Link>
        </div>
      </div>
    </div>
  );
}
