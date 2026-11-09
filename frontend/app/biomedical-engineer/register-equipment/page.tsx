"use client";

import React from "react";
import { FormProvider, useFormState } from "./context/FormContext";

import RegistrationMethod from "../components/RegistrationMethod";
import CsvEquipmentImport from "../components/CsvEquipmentImport";
import EquipmentDetails from "../components/EquipmentDetails";
import LocationSpecs from "../components/LocationSpecs";
import ReviewDetails from "../components/ReviewDetails";
import PhotoDocs from "../components/PhotoDocs";
import SuccessState from "../components/SuccessState";

function StepViewManager() {
  const { currentStep, formData } = useFormState();

  switch (currentStep) {
    case 1:
      return <RegistrationMethod />;

    case 2:
      return formData.registrationMethod === "csv" ? (
        <CsvEquipmentImport />
      ) : (
        <EquipmentDetails />
      );

    case 3:
      return <LocationSpecs />;

    case 4:
      return <ReviewDetails />;

    case 5:
      return <PhotoDocs />;

    case 6:
      return <SuccessState />;

    default:
      return <RegistrationMethod />;
  }
}

export default function RegisterEquipmentPage() {
  return (
    <FormProvider>
      <div className="min-h-full w-full bg-[#fbf9f6] px-5 py-6 sm:px-7 lg:px-8 lg:py-6">
        <div className="mb-7">
          <div className="mx-auto w-full">
            <div className="grid grid-cols-5">
              {[1, 2, 3, 4, 5].map((step) => (
                <StepProgressCircle key={step} targetStep={step} />
              ))}
            </div>
          </div>
        </div>

        <div className="w-full bg-transparent">
          <StepViewManager />
        </div>
      </div>
    </FormProvider>
  );
}

function StepProgressCircle({ targetStep }: { targetStep: number }) {
  const { currentStep, maxReachedStep, goToStep } = useFormState();

  const isActive = currentStep === targetStep;
  const isCompleted = currentStep > targetStep;
  const isSuccess = currentStep === 6;

  const isAllowedToClick = targetStep <= maxReachedStep && !isSuccess;

  const stepTitles = [
    "Method",
    "Details / CSV",
    "Location",
    "Review",
    "Documents",
  ];

  return (
    <div className="relative flex min-w-0 flex-col items-center">
      {targetStep < 5 && (
        <div
          aria-hidden="true"
          className={`absolute left-1/2 top-2.5 z-0 h-0.5 w-full md:top-3 ${
            isCompleted ? "bg-[#d99a00]" : "bg-transparent"
          }`}
        />
      )}

      <button
        type="button"
        onClick={() => goToStep(targetStep)}
        disabled={!isAllowedToClick}
        aria-current={isActive ? "step" : undefined}
        aria-label={`Step ${targetStep}: ${stepTitles[targetStep - 1]}`}
        className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
          isActive || isCompleted
            ? "bg-[#d99a00] text-white"
            : "bg-[#d9dee5] text-transparent"
        } ${isAllowedToClick ? "cursor-pointer" : "cursor-not-allowed"}`}
      >
        {isCompleted ? "✓" : ""}
      </button>

      <span
        className={`mt-2 whitespace-nowrap text-center text-[10px] md:text-xs ${
          isActive || isCompleted
            ? "font-medium text-slate-700"
            : "font-normal text-slate-400"
        }`}
      >
        {stepTitles[targetStep - 1]}
      </span>
    </div>
  );
}
