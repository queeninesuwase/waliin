"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { ApiError } from "@/lib/api/client";
import { getDepartments } from "@/lib/api/equipment";
import { requestPasswordReset, roleLabel } from "@/lib/auth";
import { checkPhotoFile, resizePhoto, savePhoto } from "@/lib/profilePhoto";
import { THEMES } from "@/lib/theme";
import { useProfilePhoto } from "@/lib/useProfilePhoto";
import { useTheme } from "@/lib/useTheme";

import ProfileAvatar from "./ProfileAvatar";

export type ProfileUser = {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  department_id?: string | null;
};

type Notice = { kind: "success" | "error"; text: string } | null;

const CARD = "rounded-xl border border-[#e8b4c0] bg-white p-6";

function useDepartmentName(departmentId?: string | null) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!departmentId) return;
    let active = true;
    getDepartments().then(
      (rows) => {
        const match = rows.find((row) => row.department_id === departmentId);
        if (active && match) setName(match.department_name);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [departmentId]);

  if (!departmentId) return "Not assigned";
  return name ?? "Loading...";
}

export default function ProfileView({
  user,
  onSignOut,
}: {
  user: ProfileUser;
  onSignOut: () => Promise<void>;
}) {
  const name = user.full_name?.trim() || user.email;
  const role = roleLabel(user.role) ?? user.role;
  const department = useDepartmentName(user.department_id);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await onSignOut();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <span className="inline-block rounded-md bg-[#d9a00a]/15 px-3 py-1 text-xs font-semibold text-[#b07f00]">
          My profile
        </span>
        <h1 className="mt-3 text-3xl font-bold text-[#650d2f]">My profile</h1>
        <p className="mt-1 text-base text-gray-500">
          Your account details, photo and security.
        </p>
      </div>

      <PhotoCard user={user} name={name} role={role} />

      <section className={CARD}>
        <h2 className="text-lg font-bold text-[#650d2f]">Account details</h2>
        <p className="mb-5 text-sm text-gray-500">
          These details come from your invitation.
        </p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Full name" value={name} />
          <Detail label="Role" value={role} />
          <Detail label="Email address" value={user.email} />
          <Detail label="Department" value={department} />
        </dl>
      </section>

      <SecuritySection
        email={user.email}
        mfaRequired={user.role === "biomedical_engineer"}
      />

      <AppearanceSection />

      <section
        className={`${CARD} flex flex-wrap items-center justify-between gap-4`}
      >
        <div>
          <h2 className="text-lg font-bold text-[#650d2f]">Sign out</h2>
          <p className="text-sm text-gray-500">
            Sign out of Waliin on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="h-11 rounded-lg bg-[#650d2f] px-6 text-sm font-semibold text-white hover:bg-[#4e0a25] disabled:opacity-60"
        >
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </section>
    </div>
  );
}

function PhotoCard({
  user,
  name,
  role,
}: {
  user: ProfileUser;
  name: string;
  role: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const photo = useProfilePhoto(user.user_id);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = checkPhotoFile(file);
    if (problem) {
      setNotice({ kind: "error", text: problem });
      return;
    }
    setBusy(true);
    try {
      const saved = savePhoto(user.user_id, await resizePhoto(file));
      setNotice(
        saved
          ? { kind: "success", text: "Photo updated." }
          : { kind: "error", text: "Could not save the photo on this device." },
      );
    } catch {
      setNotice({
        kind: "error",
        text: "Could not read this image. Try another one.",
      });
    }
    setBusy(false);
  }

  function remove() {
    savePhoto(user.user_id, null);
    setNotice({ kind: "success", text: "Photo removed." });
  }

  return (
    <section className={`${CARD} flex flex-col items-center gap-5 sm:flex-row`}>
      <ProfileAvatar
        userId={user.user_id}
        fullName={user.full_name}
        email={user.email}
        className="h-24 w-24 text-3xl"
      />
      <div className="flex flex-1 flex-col items-center gap-1 text-center sm:items-start sm:text-left">
        <p className="text-xl font-bold text-gray-900">{name}</p>
        <p className="text-sm text-gray-500">
          {role} · {user.email}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          PNG, JPG or WebP up to 5 MB. The photo is kept on this device.
        </p>
        {notice && (
          <p
            role={notice.kind === "error" ? "alert" : "status"}
            className={`mt-1 text-sm ${notice.kind === "error" ? "text-[#650d2f]" : "text-green-700"}`}
          >
            {notice.text}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={choose}
          className="sr-only"
          aria-label="Upload a profile photo"
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="h-11 rounded-lg bg-[#d9a00a] px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Uploading..." : photo ? "Change photo" : "Upload photo"}
        </button>
        {photo && (
          <button
            type="button"
            onClick={remove}
            className="h-11 rounded-lg border border-[#e8b4c0] bg-white px-5 text-sm font-semibold text-[#650d2f] hover:bg-[#e8b4c0]/20"
          >
            Remove
          </button>
        )}
      </div>
    </section>
  );
}

function SecuritySection({
  email,
  mfaRequired,
}: {
  email: string;
  mfaRequired: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function sendReset() {
    setSending(true);
    setNotice(null);
    try {
      await requestPasswordReset(email);
      setNotice({ kind: "success", text: `We sent a reset link to ${email}.` });
    } catch (err) {
      setNotice({
        kind: "error",
        text:
          err instanceof ApiError && err.status === 0
            ? "Cannot reach the server. Check your connection."
            : err instanceof ApiError && err.status === 429
              ? "Too many requests. Wait 15 minutes and try again."
              : "Could not send the link. Try again.",
      });
    }
    setSending(false);
  }

  return (
    <section className={CARD}>
      <h2 className="text-lg font-bold text-[#650d2f]">Security</h2>
      <p className="mb-5 text-sm text-gray-500">Keep your account safe.</p>
      <div className="flex flex-col divide-y divide-[#e8b4c0]/60">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div>
            <p className="text-base font-semibold text-gray-900">
              Two-step sign-in
            </p>
            <p className="text-sm text-gray-500">
              {mfaRequired
                ? "A code from your authenticator app is needed at every sign-in."
                : "Not required for your role."}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              mfaRequired
                ? "bg-green-50 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {mfaRequired ? "On" : "Off"}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div>
            <p className="text-base font-semibold text-gray-900">Password</p>
            <p className="text-sm text-gray-500">
              We email you a link to choose a new password.
            </p>
            {notice && (
              <p
                role={notice.kind === "error" ? "alert" : "status"}
                className={`mt-1 text-sm ${notice.kind === "error" ? "text-[#650d2f]" : "text-green-700"}`}
              >
                {notice.text}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={sendReset}
            disabled={sending}
            className="h-11 rounded-lg border border-[#650d2f] px-5 text-sm font-semibold text-[#650d2f] hover:bg-[#650d2f] hover:text-white disabled:opacity-60"
          >
            {sending ? "Sending..." : "Change password"}
          </button>
        </div>
      </div>
    </section>
  );
}

function AppearanceSection() {
  const [theme, setTheme] = useTheme();

  return (
    <section className={CARD}>
      <h2 className="text-lg font-bold text-[#650d2f]">Appearance</h2>
      <p className="mb-5 text-sm text-gray-500">
        Choose how Waliin looks on this device.
      </p>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="grid gap-3 sm:grid-cols-3"
      >
        {THEMES.map((option) => {
          const selected = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(option.value)}
              className={`flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left ${
                selected
                  ? "border-[#650d2f] bg-[#e8b4c0]/20"
                  : "border-[#e8b4c0] bg-white hover:border-[#650d2f]"
              }`}
            >
              <span className="text-base font-semibold text-gray-900">
                {option.label}
              </span>
              <span className="text-xs text-gray-500">{option.hint}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="rounded-lg border border-[#e8b4c0] bg-[#fbfaf7] px-4 py-3 text-base text-gray-900">
        {value}
      </dd>
    </div>
  );
}
