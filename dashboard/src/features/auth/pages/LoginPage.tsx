"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import AuthField from "@/features/auth/components/AuthField";
import AuthScreen from "@/features/auth/components/AuthScreen";
import FormMessage from "@/features/auth/components/FormMessage";
import PasswordField from "@/features/auth/components/PasswordField";
import SubmitButton from "@/features/auth/components/SubmitButton";
import { MailIcon } from "@/features/auth/components/icons";
import { login, pathAfterLogin } from "@/features/auth/api";
import { checkEmail, checkPassword } from "@/features/auth/validation";
import { ApiError } from "@/lib/api/client";

type LoginForm = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit({ email, password }: LoginForm) {
    try {
      const status = await login(email.trim(), password);
      setSignedIn(true);
      router.push(pathAfterLogin(status));
    } catch (err) {
      setError("root", {
        message:
          err instanceof ApiError
            ? err.message
            : "Could not sign in. Try again.",
      });
    }
  }

  return (
    <AuthScreen>
      <h1 className="text-center text-3xl font-bold text-brand md:text-4xl">
        Welcome back
      </h1>
      <p className="mt-3 text-center text-base text-gray-500 md:text-lg">
        Sign in to your account.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-8 flex flex-col gap-4 md:mt-6"
      >
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email", { validate: checkEmail })}
          trailing={
            <MailIcon className="pointer-events-none absolute top-1/2 right-3.5 h-5 w-5 -translate-y-1/2 text-brand" />
          }
        />

        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password", { validate: checkPassword })}
        />

        <Link
          href="/forgot-password"
          className="self-end text-sm font-medium text-gold hover:underline md:text-brand"
        >
          Forgot password?
        </Link>

        {errors.root?.message && (
          <FormMessage kind="error">{errors.root.message}</FormMessage>
        )}

        <SubmitButton
          loading={isSubmitting || signedIn}
          loadingText="Signing in..."
        >
          Sign in
        </SubmitButton>
      </form>
    </AuthScreen>
  );
}
