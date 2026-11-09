"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import Dialog from "@/components/ui/Dialog";
import { ApiError, isSignedOutError } from "@/lib/api/client";

import {
  checkDepartmentName,
  createDepartment,
  departmentErrorMessage,
  type Department,
} from "./api";

type AddDepartmentValues = {
  name: string;
  description: string;
};

type AddDepartmentDialogProps = {
  onAdded: (department: Department) => void;
  onClose: () => void;
};

const FIELD_CLASS =
  "w-full rounded-lg border bg-white px-4 text-base text-foreground placeholder:text-gray-400 focus:border-brand focus:outline-none";

export default function AddDepartmentDialog({
  onAdded,
  onClose,
}: AddDepartmentDialogProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddDepartmentValues>({
    mode: "onTouched",
    defaultValues: { name: "", description: "" },
  });

  async function onSubmit({ name, description }: AddDepartmentValues) {
    try {
      const department = await createDepartment({
        department_name: name.trim(),
        description: description.trim() || undefined,
      });
      onAdded(department);
    } catch (err) {
      if (isSignedOutError(err)) {
        router.replace("/login");
        return;
      }
      const status = err instanceof ApiError ? err.status : -1;
      setError(status === 409 ? "name" : "root", {
        message: departmentErrorMessage(status),
      });
    }
  }

  return (
    <Dialog title="Add department" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.stopPropagation();
          handleSubmit(onSubmit)(event);
        }}
        noValidate
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="department-name"
            className="text-base font-medium text-gray-600"
          >
            Department name *
          </label>
          <input
            id="department-name"
            placeholder="ICU"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "department-name-error" : undefined}
            className={`${FIELD_CLASS} h-12 ${errors.name ? "border-brand" : "border-rose"}`}
            {...register("name", { validate: checkDepartmentName })}
          />
          {errors.name?.message && (
            <p id="department-name-error" className="text-sm text-brand">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="department-description"
            className="text-base font-medium text-gray-600"
          >
            Description (optional)
          </label>
          <textarea
            id="department-description"
            rows={3}
            maxLength={500}
            className={`${FIELD_CLASS} border-rose py-3`}
            {...register("description")}
          />
        </div>

        {errors.root?.message && (
          <p role="alert" className="text-sm text-brand">
            {errors.root.message}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg border border-rose px-5 text-sm font-semibold text-brand hover:bg-cream"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {isSubmitting ? "Adding..." : "Add department"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
