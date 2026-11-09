"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { ApiError } from "@/lib/api/client";
import {
  confirmMfa,
  formatSecret,
  getCurrentUser,
  mfaErrorMessage,
  pathAfterLogin,
  setupMfa,
  type MfaSetupResponse,
} from "@/lib/auth";
import { checkCode } from "@/lib/validation";

import AuthField from "./AuthField";
import AuthScreen from "./AuthScreen";
import FormMessage from "./FormMessage";
import IconCircle from "./IconCircle";

type CodeForm = { code: string };

export default function MfaSetupForm() {
  const router = useRouter();
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [loadingKey, setLoadingKey] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CodeForm>({ mode: "onTouched", defaultValues: { code: "" } });

  function leaveIfNeeded(err: unknown) {
    if (err instanceof ApiError && err.status === 401) {
      router.replace("/login");
      return true;
    }
    if (err instanceof ApiError && err.status === 409) {
      router.replace("/login/verify");
      return true;
    }
    return false;
  }

  async function showKey() {
    setKeyError("");
    setLoadingKey(true);
    try {
      setSetup(await setupMfa());
    } catch (err) {
      if (!leaveIfNeeded(err)) {
        setKeyError(
          err instanceof ApiError && err.status === 0
            ? "Cannot reach the server. Check your connection."
            : "Could not load your QR code. Try again.",
        );
      }
    }
    setLoadingKey(false);
  }

  async function onSubmit({ code }: CodeForm) {
    try {
      await confirmMfa(code.trim());
      setDone(true);
      const me = await getCurrentUser();
      router.replace(pathAfterLogin(me));
    } catch (err) {
      setDone(false);
      if (!leaveIfNeeded(err)) {
        setError("root", { message: mfaErrorMessage(err) });
      }
    }
  }

  return (
    <AuthScreen backHref="/login">
      <IconCircle>
        <ShieldCheck className="h-8 w-8" aria-hidden="true" />
      </IconCircle>
      <h1 className="mt-6 text-center text-3xl font-bold text-brand md:text-4xl">
        Set up your authenticator
      </h1>
      <p className="mt-3 text-center text-base text-muted md:text-lg">
        Engineers need a code from their phone each time they sign in.
      </p>

      <ol className="mt-8 flex list-decimal flex-col gap-2 pl-5 text-base text-foreground">
        <li>Install Google Authenticator or Microsoft Authenticator.</li>
        <li>In the app, tap + and choose &quot;Scan a QR code&quot;.</li>
        <li>Scan the code below with your phone camera.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>

      {setup ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-6 flex flex-col gap-4"
        >
          <div className="flex flex-col items-center gap-4 rounded-lg border border-[#e8b4c0] bg-white p-4 text-center">
            <QRCodeSVG
              value={setup.otpauth_uri}
              size={200}
              level="M"
              marginSize={2}
              bgColor="#ffffff"
              fgColor="#000000"
              title="QR code for your authenticator app"
            />
            <div>
              <p className="text-sm font-semibold text-muted">
                Can&apos;t scan? In the app choose &quot;Enter a setup
                key&quot;, type this key and choose &quot;Time based&quot;.
              </p>
              <p className="mt-1 font-mono text-lg tracking-wider break-all text-foreground select-all">
                {formatSecret(setup.secret)}
              </p>
            </div>
          </div>

          <AuthField
            id="code"
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            error={errors.code?.message}
            {...register("code", { validate: checkCode })}
          />

          {errors.root?.message && (
            <FormMessage kind="error">{errors.root.message}</FormMessage>
          )}

          <button
            type="submit"
            disabled={isSubmitting || done}
            className="h-14 w-full rounded-lg bg-brand text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {isSubmitting || done ? "Checking..." : "Turn on"}
          </button>
        </form>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {keyError && <FormMessage kind="error">{keyError}</FormMessage>}
          <button
            type="button"
            onClick={showKey}
            disabled={loadingKey}
            className="h-14 w-full rounded-lg bg-brand text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {loadingKey ? "Loading..." : "Show my QR code"}
          </button>
        </div>
      )}
    </AuthScreen>
  );
}
