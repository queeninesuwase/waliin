"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  isExpiredResetLink,
  resetErrorMessage,
  resetPassword,
} from "@/lib/auth";
import {
  checkConfirmPassword,
  checkNewPassword,
  MIN_PASSWORD_LENGTH,
} from "@/lib/validation";

import AuthScreen from "./AuthScreen";
import FormMessage from "./FormMessage";
import IconCircle from "./IconCircle";
import PasswordField from "./PasswordField";

const BACK_TO_SIGN_IN_MS = 3000;

type ResetValues = {
  password: string;
  confirmPassword: string;
};

export default function ResetPasswordForm() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [done, setDone] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    mode: "onTouched",
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(
      () => router.replace("/login"),
      BACK_TO_SIGN_IN_MS,
    );
    return () => window.clearTimeout(timer);
  }, [done, router]);

  async function onSubmit({ password, confirmPassword }: ResetValues) {
    try {
      await resetPassword(token, password, confirmPassword);
      setDone(true);
    } catch (err) {
      setLinkExpired(isExpiredResetLink(err));
      setError("root", { message: resetErrorMessage(err) });
    }
  }

  return (
    <AuthScreen backHref="/login">
      <div className="flex flex-col items-center text-center">
        <IconCircle>
          <Lock className="h-7 w-7" aria-hidden="true" />
        </IconCircle>
        <h1 className="mt-6 text-3xl font-bold text-brand md:text-4xl">
          Reset your password
        </h1>
        <p className="mt-3 text-base text-muted md:text-lg">
          Enter your new password.
        </p>
      </div>

      {done ? (
        <div className="mt-8 flex flex-col gap-4">
          <FormMessage kind="success">
            Your password has been changed. Taking you to sign in...
          </FormMessage>
          <Link
            href="/login"
            className="text-center text-sm font-medium text-accent hover:underline"
          >
            Go to sign in now
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-8 flex flex-col gap-4"
        >
          <PasswordField
            id="new-password"
            label="New password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password", { validate: checkNewPassword })}
          />
          <PasswordField
            id="confirm-password"
            label="Confirm password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword", {
              validate: (value, values) =>
                checkConfirmPassword(value, values.password),
            })}
          />
          <p className="text-sm text-muted">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>

          {errors.root?.message && (
            <FormMessage kind="error">
              {errors.root.message}{" "}
              {linkExpired && (
                <Link
                  href="/forgot-password"
                  className="font-semibold underline"
                >
                  Get a new link
                </Link>
              )}
            </FormMessage>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-14 w-full rounded-lg bg-brand text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Reset password"}
          </button>
        </form>
      )}
    </AuthScreen>
  );
}
