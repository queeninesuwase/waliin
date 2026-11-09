"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import AuthField from "@/features/auth/components/AuthField";
import AuthScreen from "@/features/auth/components/AuthScreen";
import FormMessage from "@/features/auth/components/FormMessage";
import IconCircle from "@/features/auth/components/IconCircle";
import SubmitButton from "@/features/auth/components/SubmitButton";
import { MailIcon } from "@/features/auth/components/icons";
import { requestPasswordReset } from "@/features/auth/api";
import { checkEmail } from "@/features/auth/validation";
import { ApiError } from "@/lib/api/client";

type ForgotForm = {
  email: string;
};

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ mode: "onTouched", defaultValues: { email: "" } });

  async function onSubmit({ email }: ForgotForm) {
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError("root", {
        message:
          err instanceof ApiError ? err.message : "Could not send the link.",
      });
    }
  }

  return (
    <AuthScreen backHref="/login">
      <div className="flex flex-col items-center text-center">
        <IconCircle>
          <MailIcon className="h-9 w-9" />
        </IconCircle>
        <h1 className="mt-6 text-3xl font-bold text-brand md:text-4xl">
          Forgot password
        </h1>
        <p className="mt-3 text-base text-gray-500 md:text-lg">
          Enter your email address and we&apos;ll send you a reset link.
        </p>
      </div>

      {sent ? (
        <div className="mt-8 flex flex-col gap-4">
          <FormMessage kind="success">Check your email.</FormMessage>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-8 flex flex-col gap-4"
        >
          <AuthField
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email", { validate: checkEmail })}
            trailing={
              <MailIcon className="pointer-events-none absolute top-1/2 right-3.5 h-5 w-5 -translate-y-1/2 text-brand" />
            }
          />

          {errors.root?.message && (
            <FormMessage kind="error">{errors.root.message}</FormMessage>
          )}

          <SubmitButton loading={isSubmitting} loadingText="Sending...">
            Send reset link
          </SubmitButton>
        </form>
      )}

      <Link
        href="/login"
        className="mt-6 block text-center text-sm font-medium text-gold hover:underline"
      >
        Back to login
      </Link>
    </AuthScreen>
  );
}
