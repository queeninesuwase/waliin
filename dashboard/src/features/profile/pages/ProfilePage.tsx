"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import Avatar from "@/components/ui/Avatar";
import { requestPasswordReset, type SignInStatus } from "@/features/auth/api";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { listDepartments } from "@/features/departments/api";
import { ApiError } from "@/lib/api/client";
import { checkPhotoFile, resizePhoto, savePhoto } from "@/lib/profilePhoto";
import { THEMES } from "@/lib/theme";
import { useProfilePhoto } from "@/lib/useProfilePhoto";
import { useTheme } from "@/lib/useTheme";
import { displayName, roleLabel } from "@/lib/user";

type Notice = { kind: "success" | "error"; text: string } | null;

export default function ProfilePage() {
  const { user, error, retry } = useCurrentUser();

  if (error) {
    return (
      <div
        role="alert"
        className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-rose bg-white p-8 text-center"
      >
        <p className="text-base text-brand">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="h-11 rounded-lg bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <p role="status" className="py-10 text-center text-sm text-gray-500">
        Loading...
      </p>
    );
  }

  return <ProfileContent user={user} />;
}

function useDepartmentName(departmentId: string | null) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!departmentId) return;
    let active = true;
    listDepartments().then(
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

  if (!departmentId) return "All departments";
  return name ?? "Loading...";
}

function ProfileContent({ user }: { user: SignInStatus }) {
  const name = displayName(user.full_name, user.email);
  const department = useDepartmentName(user.department_id);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <span className="inline-block rounded-md bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
          My profile
        </span>
        <h1 className="mt-3 text-3xl font-bold text-brand md:text-4xl">
          My profile
        </h1>
        <p className="mt-1 text-base text-gray-500">
          Your account details, photo, security and appearance.
        </p>
      </div>

      <PhotoCard user={user} name={name} />

      <Section
        title="Account details"
        subtitle="These details come from your invitation."
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Full name" value={name} />
          <Detail label="Role" value={roleLabel(user.role)} />
          <Detail label="Email address" value={user.email} />
          <Detail label="Department" value={department} />
        </dl>
      </Section>

      <SecuritySection email={user.email} />

      <AppearanceSection />
    </div>
  );
}

function PhotoCard({ user, name }: { user: SignInStatus; name: string }) {
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
          : {
              kind: "error",
              text: "Could not save the photo in this browser.",
            },
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
    <section className="flex flex-col items-center gap-5 rounded-xl border border-rose bg-white p-6 sm:flex-row">
      <Avatar
        userId={user.user_id}
        fullName={user.full_name}
        email={user.email}
        className="h-24 w-24 text-3xl"
      />
      <div className="flex flex-1 flex-col items-center gap-1 text-center sm:items-start sm:text-left">
        <p className="text-xl font-bold text-foreground">{name}</p>
        <p className="text-sm text-gray-500">
          {roleLabel(user.role)} · {user.email}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          PNG, JPG or WebP up to 5 MB. The photo is kept on this device.
        </p>
        {notice && (
          <p
            role={notice.kind === "error" ? "alert" : "status"}
            className={`mt-1 text-sm ${notice.kind === "error" ? "text-brand" : "text-green-700"}`}
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
          className="h-11 rounded-lg bg-gold px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Uploading..." : photo ? "Change photo" : "Upload photo"}
        </button>
        {photo && (
          <button
            type="button"
            onClick={remove}
            className="h-11 rounded-lg border border-rose bg-white px-5 text-sm font-semibold text-brand hover:bg-rose/20"
          >
            Remove
          </button>
        )}
      </div>
    </section>
  );
}

function SecuritySection({ email }: { email: string }) {
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
    <Section title="Security" subtitle="Keep your account safe.">
      <div className="flex flex-col divide-y divide-rose/50">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div>
            <p className="text-base font-semibold text-foreground">
              Two-step sign-in
            </p>
            <p className="text-sm text-gray-500">
              A code from your authenticator app is needed at every sign-in.
            </p>
          </div>
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            On
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div>
            <p className="text-base font-semibold text-foreground">Password</p>
            <p className="text-sm text-gray-500">
              We email you a link to choose a new password.
            </p>
            {notice && (
              <p
                role={notice.kind === "error" ? "alert" : "status"}
                className={`mt-1 text-sm ${notice.kind === "error" ? "text-brand" : "text-green-700"}`}
              >
                {notice.text}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={sendReset}
            disabled={sending}
            className="h-11 rounded-lg border border-brand px-5 text-sm font-semibold text-brand hover:bg-brand hover:text-white disabled:opacity-60"
          >
            {sending ? "Sending..." : "Change password"}
          </button>
        </div>
      </div>
    </Section>
  );
}

function AppearanceSection() {
  const [theme, setTheme] = useTheme();

  return (
    <Section
      title="Appearance"
      subtitle="Choose how Waliin looks on this device."
    >
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
                  ? "border-brand bg-rose/20"
                  : "border-rose bg-white hover:border-brand"
              }`}
            >
              <span className="text-base font-semibold text-foreground">
                {option.label}
              </span>
              <span className="text-xs text-gray-500">{option.hint}</span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-rose bg-white p-6">
      <h2 className="text-lg font-bold text-brand">{title}</h2>
      <p className="mb-5 text-sm text-gray-500">{subtitle}</p>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="rounded-lg border border-rose bg-cream px-4 py-3 text-base text-foreground">
        {value}
      </dd>
    </div>
  );
}
