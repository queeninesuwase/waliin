"use client";

import { useForm, useWatch } from "react-hook-form";

import Dialog from "@/components/ui/Dialog";
import type { Department } from "@/features/departments/api";

import type { InvitableRole, ManagedUser, UpdateUserInput } from "../api";
import { ROLE_OPTIONS, userChanges, type EditUserValues } from "../userHelpers";
import { checkDepartment, checkRole } from "../validation";

type EditUserDialogProps = {
  user: ManagedUser;
  departments: Department[];
  saving: boolean;
  error: string;
  onSave: (changes: UpdateUserInput) => void;
  onClose: () => void;
};

export default function EditUserDialog({
  user,
  departments,
  saving,
  error,
  onSave,
  onClose,
}: EditUserDialogProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<EditUserValues>({
    mode: "onTouched",
    defaultValues: {
      role: user.role as InvitableRole,
      departmentId: user.department_id ?? "",
    },
  });
  const watchedValues = {
    role: useWatch({ control, name: "role" }),
    departmentId: useWatch({ control, name: "departmentId" }),
  };
  const changes = userChanges(user, watchedValues);
  const hasChanges = Object.keys(changes).length > 0;

  function onSubmit(values: EditUserValues) {
    const changed = userChanges(user, values);
    if (Object.keys(changed).length > 0) onSave(changed);
  }

  return (
    <Dialog
      title="Edit user"
      description={user.full_name || user.email}
      onClose={onClose}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-5"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-base font-medium text-gray-600">
            User type
          </legend>
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-3 text-base text-foreground"
            >
              <input
                type="radio"
                value={option.value}
                className="h-5 w-5 accent-brand"
                {...register("role", { validate: checkRole })}
              />
              {option.label}
            </label>
          ))}
          {errors.role?.message && (
            <p className="text-sm text-brand">{errors.role.message}</p>
          )}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="edit-department"
            className="text-base font-medium text-gray-600"
          >
            Department
          </label>
          <select
            id="edit-department"
            aria-invalid={errors.departmentId ? true : undefined}
            aria-describedby={
              errors.departmentId ? "edit-department-error" : undefined
            }
            className={`h-12 rounded-lg border bg-white px-3 text-base text-foreground focus:border-brand focus:outline-none ${
              errors.departmentId ? "border-brand" : "border-rose"
            }`}
            {...register("departmentId", { validate: checkDepartment })}
          >
            <option value="">Choose a department</option>
            {departments.map((department) => (
              <option
                key={department.department_id}
                value={department.department_id}
              >
                {department.department_name}
              </option>
            ))}
          </select>
          {errors.departmentId?.message && (
            <p id="edit-department-error" className="text-sm text-brand">
              {errors.departmentId.message}
            </p>
          )}
        </div>

        {changes.role && (
          <p className="rounded-lg bg-cream px-4 py-3 text-base text-gray-600">
            Changing the user type signs this user out on all devices.
          </p>
        )}

        {error && (
          <p role="alert" className="text-base text-brand">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-lg border border-rose px-6 text-base font-semibold text-brand hover:bg-cream"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!hasChanges || saving}
            className="h-12 rounded-lg bg-brand px-6 text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
