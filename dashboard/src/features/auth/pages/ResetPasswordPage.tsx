"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import AuthScreen from "@/features/auth/components/AuthScreen";
import FormMessage from "@/features/auth/components/FormMessage";
import IconCircle from "@/features/auth/components/IconCircle";
import PasswordField from "@/features/auth/components/PasswordField";
import SubmitButton from "@/features/auth/components/SubmitButton";
import { LockIcon } from "@/features/auth/components/icons";
import { resetPassword } from "@/features/auth/api";
import {
  checkNewPassword,
  checkSamePassword,
} from "@/features/auth/validation";
import { ApiError } from "@/lib/api/client";

const BACK_TO_LOGIN_MS = 3000;

type ResetForm = {
  password: string;
  confirmPassword: string;
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [linkExpired, setLinkExpired] = useState(false);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    mode: "onTouched",
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(
      () => router.replace("/login"),
      BACK_TO_LOGIN_MS,
    );
    return () => window.clearTimeout(timer);
  }, [done, router]);

  async function onSubmit({ password, confirmPassword }: ResetForm) {
    try {
      await resetPassword(token, password, confirmPassword);
      setDone(true);
    } catch (err) {
      setLinkExpired(err instanceof ApiError && err.status === 400);
      setError("root", {
        message:
          err instanceof ApiError
            ? err.message
            : "Could not change the password.",
      });
    }
  }

  return (
    <AuthScreen backHref="/login">
      <div className="flex flex-col items-center text-center">
        <IconCircle>
          <LockIcon className="h-9 w-9" />
        </IconCircle>
        <h1 className="mt-6 text-3xl font-bold text-brand md:text-4xl">
          Reset your password
        </h1>
        <p className="mt-3 text-base text-gray-500 md:text-lg">
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
            className="text-center text-sm font-medium text-gold hover:underline"
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
              validate: (value, form) =>
                checkSamePassword(value, form.password),
            })}
          />
          <p className="text-sm text-gray-500">At least 12 characters.</p>

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

          <SubmitButton loading={isSubmitting} loadingText="Saving...">
            Reset password
          </SubmitButton>
        </form>
      )}
    </AuthScreen>
  );
}
