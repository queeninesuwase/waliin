"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { forgotErrorMessage, requestPasswordReset } from "@/lib/auth";
import { checkEmail } from "@/lib/validation";

import AuthField from "./AuthField";
import AuthScreen from "./AuthScreen";
import FormMessage from "./FormMessage";
import IconCircle from "./IconCircle";

type ForgotValues = {
  email: string;
};

export default function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: ForgotValues) {
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError("root", { message: forgotErrorMessage(err) });
    }
  }

  return (
    <AuthScreen backHref="/login">
      <div className="flex flex-col items-center text-center">
        <IconCircle>
          <Mail className="h-7 w-7" aria-hidden="true" />
        </IconCircle>
        <h1 className="mt-6 text-3xl font-bold text-brand md:text-4xl">
          Forgot password
        </h1>
        <p className="mt-3 text-base text-muted md:text-lg">
          Enter your email address and we&apos;ll send you a reset link.
        </p>
      </div>

      {sent ? (
        <div className="mt-8">
          <FormMessage kind="success">
            If an account exists for this email, we sent a reset link. Check
            your inbox. The link works for 5 minutes.
          </FormMessage>
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
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3.5 h-5 w-5 -translate-y-1/2 text-brand"
              />
            }
          />

          {errors.root?.message && (
            <FormMessage kind="error">{errors.root.message}</FormMessage>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-14 w-full rounded-lg bg-brand text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}

      <Link
        href="/login"
        className="mt-6 block text-center text-sm font-medium text-accent hover:underline"
      >
        Back to sign in
      </Link>
    </AuthScreen>
  );
}
