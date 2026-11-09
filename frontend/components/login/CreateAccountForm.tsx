"use client";

import { User } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import {
  acceptErrorMessage,
  acceptInvitation,
  pathAfterAccept,
} from "@/lib/auth";
import {
  checkConfirmPassword,
  checkFullName,
  checkNewPassword,
  MIN_PASSWORD_LENGTH,
} from "@/lib/validation";

import AuthField from "./AuthField";
import AuthScreen from "./AuthScreen";
import FormMessage from "./FormMessage";
import PasswordField from "./PasswordField";

type CreateAccountValues = {
  fullName: string;
  password: string;
  confirmPassword: string;
  agreed: boolean;
};

export default function CreateAccountForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<CreateAccountValues>({
    mode: "onTouched",
    defaultValues: {
      fullName: "",
      password: "",
      confirmPassword: "",
      agreed: false,
    },
  });

  async function onSubmit({
    fullName,
    password,
    confirmPassword,
  }: CreateAccountValues) {
    try {
      const reply = await acceptInvitation(
        token,
        fullName.trim(),
        password,
        confirmPassword,
      );
      router.replace(pathAfterAccept(reply.role));
    } catch (err) {
      setError("root", { message: acceptErrorMessage(err) });
    }
  }

  const loading = isSubmitting || (isSubmitSuccessful && !errors.root);

  return (
    <AuthScreen>
      <h1 className="text-center text-3xl font-bold text-brand md:text-4xl">
        Create your account
      </h1>
      <p className="mt-3 text-center text-base text-muted md:text-lg">
        Join your hospital team on Waliin.
      </p>

      {!token ? (
        <div className="mt-8">
          <FormMessage kind="error">
            This invitation link is not complete. Open the link from your
            invitation email again.
          </FormMessage>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mt-8 flex flex-col gap-4"
        >
          <AuthField
            id="full-name"
            label="Full name"
            autoComplete="name"
            error={errors.fullName?.message}
            {...register("fullName", { validate: checkFullName })}
            trailing={
              <User
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3.5 h-5 w-5 -translate-y-1/2 text-brand"
              />
            }
          />
          <PasswordField
            id="password"
            label="Password"
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

          <div className="flex flex-col gap-1.5">
            <label className="flex items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-brand"
                aria-invalid={errors.agreed ? true : undefined}
                {...register("agreed", {
                  validate: (value) =>
                    value || "Agree to the terms to create your account.",
                })}
              />
              <span>
                I agree to Waliin&apos;s Terms of use and Privacy policy.
              </span>
            </label>
            {errors.agreed?.message && (
              <p className="text-sm text-brand">{errors.agreed.message}</p>
            )}
          </div>

          {errors.root?.message && (
            <FormMessage kind="error">{errors.root.message}</FormMessage>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-14 w-full rounded-lg bg-brand text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-accent hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthScreen>
  );
}
