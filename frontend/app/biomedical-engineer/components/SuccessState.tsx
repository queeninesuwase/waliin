"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "../register-equipment/context/FormContext";

export default function SuccessState() {
  const router = useRouter();
  const { resetForm } = useFormState();

  const handleRegisterAnother = () => {
    resetForm();
    router.push("/biomedical-engineer/register-equipment");
  };

  return (
    <div className="flex w-full animate-fadeIn flex-col items-center justify-center px-4 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center font-sans">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#c59124]/30 bg-amber-50/50">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#c59124]">
          <svg
            className="h-5 w-5 text-[#c59124]"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      </div>

      <h2 className="max-w-sm px-2 text-xl font-bold leading-tight text-[#303d51]">
        Registration completed
      </h2>

      <p className="mt-3 max-w-xs text-xs leading-relaxed text-[#8994a5]">
        You’ve completed the equipment registration process.
      </p>

      <div className="mt-8 w-full max-w-xs space-y-3">
        <button
          type="button"
          onClick={() => router.push("/biomedical-engineer/dashboard")}
          className="min-h-12 w-full rounded-md bg-[#d99a00] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#bd8500] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c59124] focus-visible:ring-offset-2"
        >
          View dashboard
        </button>

        <button
          type="button"
          onClick={handleRegisterAnother}
          className="min-h-12 w-full rounded-md border border-[#efcbd1] bg-white px-4 py-3 text-sm font-semibold text-[#8a1238] transition-colors hover:bg-[#fff7f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c59124] focus-visible:ring-offset-2"
        >
          Register another equipment
        </button>
      </div>
    </div>
  );
}
