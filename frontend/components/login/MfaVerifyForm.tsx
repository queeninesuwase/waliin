"use client";

import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { ApiError } from "@/lib/api/client";
import {
  getCurrentUser,
  mfaErrorMessage,
  pathAfterLogin,
  verifyMfa,
} from "@/lib/auth";
import { checkCode } from "@/lib/validation";

import AuthField from "./AuthField";
import AuthScreen from "./AuthScreen";
import FormMessage from "./FormMessage";
import IconCircle from "./IconCircle";

type CodeForm = { code: string };

export default function MfaVerifyForm() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CodeForm>({ mode: "onTouched", defaultValues: { code: "" } });

  async function onSubmit({ code }: CodeForm) {
    try {
      await verifyMfa(code.trim());
      setDone(true);
      const me = await getCurrentUser();
      router.replace(pathAfterLogin(me));
    } catch (err) {
      setDone(false);
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        router.replace("/login/setup-mfa");
        return;
      }
      setError("root", { message: mfaErrorMessage(err) });
    }
  }

  return (
    <AuthScreen backHref="/login">
      <IconCircle>
        <LockKeyhole className="h-8 w-8" aria-hidden="true" />
      </IconCircle>
      <h1 className="mt-6 text-center text-3xl font-bold text-brand md:text-4xl">
        Enter your 6-digit code
      </h1>
      <p className="mt-3 text-center text-base text-muted md:text-lg">
        Open your authenticator app and type the code shown for Waliin.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-8 flex flex-col gap-4"
      >
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
          {isSubmitting || done ? "Checking..." : "Verify"}
        </button>
      </form>
    </AuthScreen>
  );
}
