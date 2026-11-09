"use client";

import { useFormState } from "../register-equipment/context/FormContext";

export default function RegistrationMethod() {
  const { setFormData, advanceToStep } = useFormState();

  function chooseMethod(method: "manual" | "csv") {
    setFormData((previous) => ({
      ...previous,
      registrationMethod: method,
    }));

    advanceToStep(2);
  }

  return (
    <section className="mx-auto w-full max-w-7xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
        Equipment registration
      </p>

      <h2 className="mt-2 text-xl font-semibold text-slate-900 lg:text-2xl">
        How would you like to register equipment?
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        Register one item manually or import multiple items from a CSV file.
        Both options lead to the shared document upload step.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => chooseMethod("manual")}
          className="min-h-[160px] rounded-xl border border-slate-200 p-5 lg:min-h-[220px] lg:p-8 text-left transition hover:border-amber-500 hover:bg-amber-50"
        >
          <span className="text-lg font-semibold text-slate-900">
            Manual entry
          </span>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enter equipment details individually using the registration form.
          </p>
        </button>

        <button
          type="button"
          onClick={() => chooseMethod("csv")}
          className="min-h-[160px] rounded-xl border border-slate-200 p-5 lg:min-h-[220px] lg:p-8 text-left transition hover:border-amber-500 hover:bg-amber-50"
        >
          <span className="text-lg font-semibold text-slate-900">
            CSV import
          </span>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Upload a CSV file to register multiple equipment records.
          </p>
        </button>
      </div>
    </section>
  );
}
