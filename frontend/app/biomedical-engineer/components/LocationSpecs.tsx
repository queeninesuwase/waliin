"use client";

import React, { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { getDepartments, type Department } from "@/lib/api/equipment";
import { useForm } from "react-hook-form";
import { useFormState } from "../register-equipment/context/FormContext";

interface Step2Inputs {
  facilityName: string;
  department: string;
  departmentId: string;
  wardRoom: string;
  powerSupply: string;
  installationDate: string;
  status: string;
}

const fieldClass =
  "h-[39px] box-border w-full min-w-0 rounded-md border border-[#efb8c2] bg-white px-[10px] text-[12px] text-[#39465a] outline-none transition focus:border-[#c59124] focus:ring-1 focus:ring-[#c59124]/30";

const labelClass = "mb-[6px] block text-[10px] font-normal text-[#8994a5]";

// Frontend status options
const SERVICE_STATUS_OPTIONS = [
  { value: "not_assessed", label: "Not assessed" },
  { value: "in_service", label: "Operational" },
  { value: "out_of_service", label: "Out of service" },
  { value: "under_maintenance", label: "Under maintenance" },
  { value: "not_installed", label: "Not installed" },
  { value: "incomplete", label: "Incomplete" },
  { value: "retired", label: "Retired" },
] as const;

export default function LocationSpecs() {
  const { formData, setFormData, nextStep, prevStep } = useFormState();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useState("");

  // Fetch departments from the existing backend endpoint
  useEffect(() => {
    let active = true;

    getDepartments()
      .then((items) => {
        if (active) {
          setDepartments(items.filter((item) => item.is_active));
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setDepartmentsError(
            error instanceof ApiError
              ? error.message
              : "Unable to load departments. Please try again.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setDepartmentsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Step2Inputs>({
    defaultValues: {
      facilityName: formData.facilityName || "",
      department: formData.departmentId || "",
      departmentId: formData.departmentId || "",
      wardRoom: formData.wardRoom || "",
      powerSupply: formData.powerSupply || "",
      installationDate: formData.installationDate || "",
      status: formData.status || "",
    },
  });

  const onSubmit = (data: Step2Inputs) => {
    const selectedDepartment = departments.find(
      (item) => item.department_id === data.department,
    );

    if (!selectedDepartment) {
      setDepartmentsError("Please select a valid department.");
      return;
    }

    setFormData((previous) => ({
      ...previous,
      ...data,
      department: selectedDepartment.department_name,
      departmentId: selectedDepartment.department_id,
    }));

    nextStep();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full flex-col text-left"
    >
      <div className="grid w-full grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-x-10">
        {/* Location details */}
        <section className="flex min-w-0 flex-col gap-[15px]">
          <h2 className="mb-2 text-[20px] font-bold leading-tight text-[#303d51]">
            Location details
          </h2>

          <div>
            <label htmlFor="facilityName" className={labelClass}>
              Facility *
            </label>

            <input
              id="facilityName"
              type="text"
              placeholder="Enter facility name"
              {...register("facilityName", {
                required: "Facility is required",
              })}
              className={`${fieldClass} ${
                errors.facilityName ? "border-red-500" : ""
              }`}
            />

            {errors.facilityName && (
              <p className="mt-1 text-[10px] text-red-600">
                {errors.facilityName.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="department" className={labelClass}>
              Department *
            </label>

            <select
              id="department"
              {...register("department", {
                required: "Department is required",
              })}
              disabled={departmentsLoading || departments.length === 0}
              className={`${fieldClass} ${
                errors.department ? "border-red-500" : ""
              }`}
            >
              <option value="">
                {departmentsLoading
                  ? "Loading departments..."
                  : departments.length === 0
                    ? "No departments available"
                    : "Select department"}
              </option>

              {departments.map((item) => (
                <option key={item.department_id} value={item.department_id}>
                  {item.department_name}
                </option>
              ))}
            </select>

            {departmentsError && (
              <p role="alert" className="mt-1 text-[10px] text-red-600">
                {departmentsError}
              </p>
            )}

            {errors.department && (
              <p className="mt-1 text-[10px] text-red-600">
                {errors.department.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="wardRoom" className={labelClass}>
              Ward / room *
            </label>

            <input
              id="wardRoom"
              type="text"
              placeholder="Enter ward or room"
              {...register("wardRoom", {
                required: "Ward / room is required",
              })}
              className={`${fieldClass} ${
                errors.wardRoom ? "border-red-500" : ""
              }`}
            />

            {errors.wardRoom && (
              <p className="mt-1 text-[10px] text-red-600">
                {errors.wardRoom.message}
              </p>
            )}
          </div>
        </section>

        {/* Specifications */}
        <section className="flex min-w-0 flex-col gap-[15px]">
          <h2 className="mb-2 text-[20px] font-bold leading-tight text-[#303d51]">
            Specifications
          </h2>

          <div>
            <label htmlFor="powerSupply" className={labelClass}>
              Power supply (optional)
            </label>

            <input
              id="powerSupply"
              type="text"
              placeholder="Enter power supply"
              {...register("powerSupply")}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="installationDate" className={labelClass}>
              Installation date
            </label>

            <input
              id="installationDate"
              type="date"
              {...register("installationDate")}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="status" className={labelClass}>
              Status *
            </label>

            <select
              id="status"
              {...register("status", {
                required: "Please select a status",
              })}
              className={`${fieldClass} ${
                errors.status ? "border-red-500" : ""
              }`}
            >
              <option value="">Select status</option>

              {SERVICE_STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            {errors.status && (
              <p className="mt-1 text-[10px] text-red-600">
                {errors.status.message}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Navigation buttons */}
      <div className="mt-8 grid grid-cols-[0.8fr_1.4fr] gap-2 border-t border-[#f1e6e5] pt-4 pb-[calc(12px+env(safe-area-inset-bottom))] lg:flex lg:justify-end lg:gap-3 lg:border-0 lg:pb-0">
        <button
          type="button"
          onClick={prevStep}
          className="h-[43px] w-full rounded-md border border-[#efcbd1] bg-white text-[12px] font-semibold text-[#8a1238] transition hover:bg-[#fff7f8] sm:w-[114px]"
        >
          Back
        </button>

        <button
          type="submit"
          className="flex h-[43px] w-full items-center justify-center gap-2 rounded-md bg-[#d99a00] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#bd8500] sm:w-[184px]"
        >
          <span>Next</span>

          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 12h14m-6-6 6 6-6 6"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}
