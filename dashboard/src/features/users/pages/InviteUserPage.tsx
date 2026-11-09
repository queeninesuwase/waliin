"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import AddDepartmentDialog from "@/features/departments/AddDepartmentDialog";

import { isSignedOutError, ApiError } from "@/lib/api/client";

import { inviteUser, type InvitableRole } from "../api";
import RoleCard from "../components/RoleCard";
import { useDepartments } from "../hooks/useDepartments";
import { inviteErrorMessage, ROLE_OPTIONS } from "../userHelpers";
import { checkDepartment, checkInviteEmail, checkRole } from "../validation";

type InviteValues = {
  role: InvitableRole | "";
  email: string;
  departmentId: string;
};

const FIELD_CLASS =
  "h-14 w-full rounded-lg border bg-white px-4 text-lg text-foreground placeholder:text-gray-400 focus:border-brand focus:outline-none";

export default function InviteUserPage() {
  const router = useRouter();
  const {
    departments,
    error: departmentsError,
    retry,
    addDepartment,
  } = useDepartments();
  const [addingDepartment, setAddingDepartment] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<InviteValues>({
    mode: "onTouched",
    defaultValues: { role: "clinical_staff", email: "", departmentId: "" },
  });
  const role = useWatch({ control, name: "role" });

  async function onSubmit({ role: chosen, email, departmentId }: InviteValues) {
    const cleanEmail = email.trim().toLowerCase();
    try {
      await inviteUser({
        email: cleanEmail,
        role: chosen as InvitableRole,
        department_id: departmentId,
      });
      router.push(`/users/invite/sent?email=${encodeURIComponent(cleanEmail)}`);
    } catch (err) {
      if (isSignedOutError(err)) {
        router.replace("/login");
        return;
      }
      const message = inviteErrorMessage(err);
      if (err instanceof ApiError && err.status === 409) {
        setError("email", { message });
      } else {
        setError("root", { message });
      }
    }
  }

  const sending =
    isSubmitting || (isSubmitSuccessful && !errors.root && !errors.email);

  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <h1 className="text-4xl font-bold text-brand">Invite user</h1>
        <p className="mt-2 text-lg text-gray-500">
          Add a health worker or an engineer to your facility.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-8 rounded-lg border border-gray-100 bg-white p-6 md:p-10"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-3 text-base font-medium text-gray-600">
            User type *
          </legend>
          <div className="grid gap-4 md:grid-cols-2">
            {ROLE_OPTIONS.map((option) => (
              <RoleCard
                key={option.value}
                value={option.value}
                label={option.label}
                description={option.description}
                checked={role === option.value}
                {...register("role", { validate: checkRole })}
              />
            ))}
          </div>
          {errors.role?.message && (
            <p className="text-sm text-brand">{errors.role.message}</p>
          )}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="invite-email"
            className="text-base font-medium text-gray-600"
          >
            Email address *
          </label>
          <input
            id="invite-email"
            type="email"
            autoComplete="off"
            placeholder="name@hospital.et"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "invite-email-error" : undefined}
            className={`${FIELD_CLASS} ${errors.email ? "border-brand" : "border-rose"}`}
            {...register("email", { validate: checkInviteEmail })}
          />
          {errors.email?.message && (
            <p id="invite-email-error" className="text-sm text-brand">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="invite-department"
              className="text-base font-medium text-gray-600"
            >
              Department *
            </label>
            <button
              type="button"
              onClick={() => setAddingDepartment(true)}
              className="text-base font-semibold text-brand hover:underline"
            >
              + Add department
            </button>
          </div>
          {departmentsError ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-4 rounded-lg bg-rose/30 px-4 py-3 text-sm text-brand"
            >
              <span>{departmentsError}</span>
              <button
                type="button"
                onClick={retry}
                className="font-semibold underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <select
              id="invite-department"
              disabled={!departments}
              aria-invalid={errors.departmentId ? true : undefined}
              aria-describedby={
                errors.departmentId ? "invite-department-error" : undefined
              }
              className={`${FIELD_CLASS} ${errors.departmentId ? "border-brand" : "border-rose"}`}
              {...register("departmentId", { validate: checkDepartment })}
            >
              <option value="">
                {departments ? "Choose a department" : "Loading departments..."}
              </option>
              {(departments ?? []).map((department) => (
                <option
                  key={department.department_id}
                  value={department.department_id}
                >
                  {department.department_name}
                </option>
              ))}
            </select>
          )}
          {errors.departmentId?.message && (
            <p id="invite-department-error" className="text-sm text-brand">
              {errors.departmentId.message}
            </p>
          )}
        </div>

        <p className="rounded-lg bg-gray-100 px-5 py-4 text-base text-gray-600">
          An invitation link will be emailed to this user. They will set their
          name and create a password to activate their account.
        </p>

        {errors.root?.message && (
          <p
            role="alert"
            className="rounded-lg bg-rose/30 px-4 py-3 text-sm text-brand"
          >
            {errors.root.message}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/users"
            className="flex h-14 items-center justify-center rounded-lg border border-rose px-12 text-base font-semibold text-brand hover:bg-cream"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={sending || !departments}
            className="h-14 rounded-lg bg-gold px-12 text-base font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send invitation"}
          </button>
        </div>
      </form>

      {addingDepartment && (
        <AddDepartmentDialog
          onAdded={(department) => {
            addDepartment(department);
            setValue("departmentId", department.department_id, {
              shouldValidate: true,
            });
            setAddingDepartment(false);
          }}
          onClose={() => setAddingDepartment(false)}
        />
      )}
    </div>
  );
}
