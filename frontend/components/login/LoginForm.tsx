"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  login,
  loginErrorMessage,
  logout,
  pathAfterLogin,
  roleLabel,
  wrongRoleMessage,
} from "@/lib/auth";
import { checkEmail, checkPassword } from "@/lib/validation";

import AuthField from "./AuthField";
import AuthScreen from "./AuthScreen";
import FormMessage from "./FormMessage";
import PasswordField from "./PasswordField";

type LoginValues = {
  email: string;
  password: string;
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chosenValue = searchParams.get("as");
  const chosenRole = roleLabel(chosenValue);
  const welcome = searchParams.get("welcome") === "1";
  const [signedIn, setSignedIn] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit({ email, password }: LoginValues) {
    try {
      const status = await login(email.trim(), password);
      const mismatch = wrongRoleMessage(chosenValue, status.role);
      if (mismatch) {
        await logout();
        setError("root", { message: mismatch });
        return;
      }
      setSignedIn(true);
      router.push(pathAfterLogin(status));
    } catch (err) {
      setError("root", { message: loginErrorMessage(err) });
    }
  }

  const loading = isSubmitting || signedIn;

  return (
    <AuthScreen backHref="/continue-as">
      <h1 className="text-center text-3xl font-bold text-brand md:text-4xl">
        Welcome back
      </h1>
      <p className="mt-3 text-center text-base text-muted md:text-lg">
        Sign in to your account.
      </p>
      {chosenRole && (
        <p className="mx-auto mt-4 w-fit rounded-full bg-[#e8b4c0]/30 px-4 py-1.5 text-sm font-semibold text-brand">
          Signing in as {chosenRole}
        </p>
      )}

      {welcome && (
        <div className="mt-6">
          <FormMessage kind="success">
            Your account is ready. Sign in with your email and new password.
          </FormMessage>
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-8 flex flex-col gap-4"
      >
        <AuthField
          id="email"
          label="Email"
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

        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password", { validate: checkPassword })}
        />

        <Link
          href="/forgot-password"
          className="self-end text-sm font-medium text-accent hover:underline"
        >
          Forgot password?
        </Link>

        {errors.root?.message && (
          <FormMessage kind="error">{errors.root.message}</FormMessage>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 h-14 w-full rounded-lg bg-brand text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        No account yet? Your health manager sends you an invitation by email.
      </p>
    </AuthScreen>
  );
}
