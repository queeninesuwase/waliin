"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { useFormState } from "../register-equipment/context/FormContext";

interface Step1Inputs {
  equipmentType: string;
  make: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  receivedAt: string;
  description: string;
  manufacturer: string;
  countryOfOrigin: string;
  purchaseDate: string;
  warrantyExpiry: string;
}

const inputClass =
  "h-[39px] w-full min-w-0 rounded-md border border-[#efb8c2] bg-white px-[10px] text-[12px] text-[#39465a] outline-none transition focus:border-[#c59124] focus:ring-1 focus:ring-[#c59124]/30";

const labelClass = "mb-[6px] block text-[10px] font-normal text-[#8994a5]";

export default function EquipmentDetails() {
  const { formData, setFormData, nextStep, prevStep } = useFormState();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Step1Inputs>({
    defaultValues: {
      equipmentType: formData.equipmentType || "",
      make: formData.make || "",
      model: formData.model || "",
      serialNumber: formData.serialNumber || "",
      assetTag: formData.assetTag || "",
      receivedAt: formData.receivedAt || "",
      description: formData.description || "",
      manufacturer: formData.manufacturer || "",
      countryOfOrigin: formData.countryOfOrigin || "",
      purchaseDate: formData.purchaseDate || "",
      warrantyExpiry: formData.warrantyExpiry || "",
    },
  });

  const onSubmit = (data: Step1Inputs) => {
    setFormData((previous) => ({
      ...previous,
      ...data,
    }));

    nextStep();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex min-h-full w-full flex-col text-left"
    >
      <div className="grid w-full grid-cols-1 items-start gap-x-8 gap-y-8 lg:grid-cols-2">
        <section className="min-w-0 space-y-[15px]">
          <h2 className="mb-5 text-[20px] font-bold leading-tight text-[#303d51]">
            Equipment details
          </h2>

          <div>
            <label className={labelClass} htmlFor="equipmentType">
              Equipment type *
            </label>
            <input
              id="equipmentType"
              {...register("equipmentType", {
                required: "Equipment type is required",
              })}
              className={inputClass}
            />
            {errors.equipmentType && (
              <p className="mt-1 text-xs text-red-600">
                {errors.equipmentType.message}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="make">
              Brand *
            </label>
            <input
              id="make"
              {...register("make", {
                required: "Brand is required",
              })}
              className={inputClass}
            />
            {errors.make && (
              <p className="mt-1 text-xs text-red-600">{errors.make.message}</p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="model">
              Model *
            </label>
            <input
              id="model"
              {...register("model", {
                required: "Model is required",
              })}
              placeholder="Enter model"
              className={inputClass}
            />
            {errors.model && (
              <p className="mt-1 text-xs text-red-600">
                {errors.model.message}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="serialNumber">
              Serial number *
            </label>
            <input
              id="serialNumber"
              {...register("serialNumber", {
                required: "Serial number is required",
              })}
              placeholder="Enter serial number"
              className={inputClass}
            />
            {errors.serialNumber && (
              <p className="mt-1 text-xs text-red-600">
                {errors.serialNumber.message}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="assetTag">
              Asset tag
            </label>
            <input
              id="assetTag"
              {...register("assetTag")}
              placeholder="Enter asset tag"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="receivedAt">
              Received at
            </label>
            <input
              id="receivedAt"
              type="date"
              {...register("receivedAt")}
              className={inputClass}
            />
          </div>

          <div className="pt-1 lg:hidden">
            <label className={labelClass} htmlFor="purchaseDate">
              Purchase date
            </label>
            <input
              id="purchaseDate"
              type="date"
              {...register("purchaseDate")}
              className={inputClass}
            />
          </div>
        </section>

        <section className="min-w-0 space-y-5">
          <div>
            <h2 className="mb-3 text-[16px] font-bold text-[#303d51]">
              Equipment description
            </h2>
            <textarea
              {...register("description")}
              rows={3}
              placeholder="Describe the equipment..."
              className="min-h-24 w-full resize-y rounded-md border border-[#efb8c2] bg-white px-[10px] py-3 text-[12px] text-[#39465a] outline-none focus:border-[#c59124] focus:ring-1 focus:ring-[#c59124]/30"
            />
          </div>

          <div className="space-y-[15px]">
            <h2 className="text-[16px] font-bold text-[#303d51]">
              Manufacturer information
            </h2>

            <div>
              <label className={labelClass} htmlFor="manufacturer">
                Manufacturer
              </label>
              <input
                id="manufacturer"
                {...register("manufacturer")}
                placeholder="Manufacturer name"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="countryOfOrigin">
                Country of origin
              </label>
              <input
                id="countryOfOrigin"
                {...register("countryOfOrigin")}
                placeholder="Enter country of origin"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="warrantyExpiry">
                Warranty expiry
              </label>
              <input
                id="warrantyExpiry"
                type="date"
                {...register("warrantyExpiry")}
                className={inputClass}
              />
            </div>

            <div className="hidden lg:block">
              <label className={labelClass} htmlFor="purchaseDateDesktop">
                Purchase date
              </label>
              <input
                id="purchaseDateDesktop"
                type="date"
                {...register("purchaseDate")}
                className={inputClass}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 grid grid-cols-[0.8fr_1.4fr] gap-2 border-t border-[#f1e6e5] pt-4 pb-[calc(12px+env(safe-area-inset-bottom))] lg:flex lg:justify-end lg:gap-3 lg:border-0 lg:pb-0">
        <button
          type="button"
          onClick={prevStep}
          className="h-[43px] w-full rounded-md border border-[#efcbd1] bg-white text-[12px] font-semibold text-[#8a1238] transition hover:bg-[#fff7f8] lg:w-[114px]"
        >
          Back
        </button>

        <button
          type="submit"
          className="flex h-[43px] w-full items-center justify-center gap-2 rounded-md bg-[#d99a00] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#bd8500] lg:w-[184px]"
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
