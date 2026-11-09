"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import AuthField from "@/features/auth/components/AuthField";
import AuthScreen from "@/features/auth/components/AuthScreen";
import FormMessage from "@/features/auth/components/FormMessage";
import IconCircle from "@/features/auth/components/IconCircle";
import SubmitButton from "@/features/auth/components/SubmitButton";
import { LockIcon } from "@/features/auth/components/icons";
import { mfaErrorMessage, verifyMfaCode } from "@/features/auth/mfaApi";
import { checkCode } from "@/features/auth/validation";
import { ApiError } from "@/lib/api/client";

type CodeForm = {
  code: string;
};

export default function MfaVerifyPage() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CodeForm>({ mode: "onTouched", defaultValues: { code: "" } });

  async function onSubmit({ code }: CodeForm) {
    try {
      await verifyMfaCode(code.trim());
      setSignedIn(true);
      router.replace("/dashboard");
    } catch (err) {
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
      <div className="flex flex-col items-center text-center">
        <IconCircle>
          <LockIcon className="h-9 w-9" />
        </IconCircle>
        <h1 className="mt-6 text-3xl font-bold text-brand md:text-4xl">
          Enter your 6-digit code
        </h1>
        <p className="mt-3 text-base text-gray-500 md:text-lg">
          Open your authenticator app and type the code shown for Waliin.
        </p>
      </div>

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

        <SubmitButton
          loading={isSubmitting || signedIn}
          loadingText="Checking..."
        >
          Verify
        </SubmitButton>
      </form>
    </AuthScreen>
  );
}
