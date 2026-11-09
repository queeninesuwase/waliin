"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import AuthField from "@/features/auth/components/AuthField";
import AuthScreen from "@/features/auth/components/AuthScreen";
import FormMessage from "@/features/auth/components/FormMessage";
import IconCircle from "@/features/auth/components/IconCircle";
import SubmitButton from "@/features/auth/components/SubmitButton";
import { ShieldIcon } from "@/features/auth/components/icons";
import {
  confirmMfaSetup,
  formatSecret,
  mfaErrorMessage,
  startMfaSetup,
  type MfaSetup,
} from "@/features/auth/mfaApi";
import { checkCode } from "@/features/auth/validation";
import { ApiError } from "@/lib/api/client";

type CodeForm = {
  code: string;
};

export default function MfaSetupPage() {
  const router = useRouter();
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [loadingKey, setLoadingKey] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CodeForm>({ mode: "onTouched", defaultValues: { code: "" } });

  function goElsewhere(err: unknown) {
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
      setSetup(await startMfaSetup());
    } catch (err) {
      if (!goElsewhere(err)) {
        setKeyError(
          err instanceof ApiError ? err.message : "Could not load the key.",
        );
      }
    }
    setLoadingKey(false);
  }

  async function onSubmit({ code }: CodeForm) {
    try {
      await confirmMfaSetup(code.trim());
      setSignedIn(true);
      router.replace("/dashboard");
    } catch (err) {
      if (!goElsewhere(err)) {
        setError("root", { message: mfaErrorMessage(err) });
      }
    }
  }

  return (
    <AuthScreen backHref="/login">
      <div className="flex flex-col items-center text-center">
        <IconCircle>
          <ShieldIcon className="h-9 w-9" />
        </IconCircle>
        <h1 className="mt-6 text-3xl font-bold text-brand md:text-4xl">
          Set up your authenticator app
        </h1>
        <p className="mt-3 text-base text-gray-500 md:text-lg">
          The dashboard needs a code from your phone each time you sign in.
        </p>
      </div>

      <ol className="mt-8 flex list-decimal flex-col gap-2 pl-5 text-base text-foreground">
        <li>Install Google Authenticator or Microsoft Authenticator.</li>
        <li>In the app, tap + and choose &quot;Enter a setup key&quot;.</li>
        <li>Type the key below and choose &quot;Time based&quot;.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>

      {setup ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-6 flex flex-col gap-4"
        >
          <div className="rounded-lg border border-rose bg-white p-4 text-center">
            <p className="text-sm font-semibold text-gray-500">Setup key</p>
            <p className="mt-1 font-mono text-lg tracking-wider break-all text-foreground select-all">
              {formatSecret(setup.secret)}
            </p>
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

          <SubmitButton
            loading={isSubmitting || signedIn}
            loadingText="Checking..."
          >
            Turn on
          </SubmitButton>
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
            {loadingKey ? "Loading..." : "Show my setup key"}
          </button>
        </div>
      )}
    </AuthScreen>
  );
}
