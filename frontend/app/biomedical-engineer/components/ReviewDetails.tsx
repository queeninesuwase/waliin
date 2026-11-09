"use client";

import React, { useState } from "react";
import { ApiError } from "@/lib/api/client";
import { registerEquipment } from "@/lib/api/equipment";
import { useFormState } from "../register-equipment/context/FormContext";

const STATUS_LABELS: Record<string, string> = {
  not_assessed: "Not assessed",
  in_service: "Operational",
  out_of_service: "Out of service",
  under_maintenance: "Under maintenance",
  not_installed: "Not installed",
  incomplete: "Incomplete",
  retired: "Retired",
};

export default function ReviewDetails() {
  const { formData, setFormData, nextStep, prevStep } = useFormState();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleRegisterSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (isSubmitting) return;

    const manufacturer = (formData.manufacturer || formData.make || "").trim();
    const model = (formData.model || "").trim();
    const category = (formData.equipmentType || "").trim();
    const assetTag = (formData.assetTag || "").trim();
    const departmentId = (formData.departmentId || "").trim();

    const location = [
      (formData.facilityName || "").trim(),
      (formData.wardRoom || "").trim(),
    ]
      .filter(Boolean)
      .join(", ");

    if (!departmentId) {
      setSubmitError(
        "A valid department is required. Go back and select a department.",
      );
      return;
    }

    if (!manufacturer || !model || !category || !assetTag || !location) {
      setSubmitError(
        "Please complete the manufacturer, model, equipment type, asset tag, facility, and ward / room fields.",
      );
      return;
    }

    const validStatuses = Object.keys(STATUS_LABELS);

    if (!validStatuses.includes(formData.status)) {
      setSubmitError("Please go back and select a valid equipment status.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const registered = await registerEquipment({
        manufacturer,
        model_name: model,
        equipment_category: category,
        department_id: departmentId,
        asset_tag: assetTag,
        serial_number: formData.serialNumber?.trim() || null,
        location,
        acquisition_type: "unknown",
        received_at: formData.receivedAt
          ? new Date(`${formData.receivedAt}T00:00:00`).toISOString()
          : null,
        installation_status: "unknown",
        service_status: formData.status as
          | "not_assessed"
          | "in_service"
          | "out_of_service"
          | "under_maintenance"
          | "not_installed"
          | "incomplete"
          | "retired",
        warranty_end_date: formData.warrantyExpiry || null,
      });

      setFormData((previous) => ({
        ...previous,
        registeredEquipment: [
          {
            equipmentId: registered.equipment_id,
            assetTag: registered.asset_tag,
            manufacturer: registered.manufacturer,
            modelName: registered.model_name,
          },
        ],
      }));

      nextStep();
    } catch (error: unknown) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : "Unable to register equipment. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const summaryItems = [
    { label: "Type", value: formData.equipmentType },
    { label: "Brand", value: formData.make || formData.manufacturer },
    { label: "Model", value: formData.model },
    { label: "Serial number", value: formData.serialNumber },
  ];

  return (
    <form
      onSubmit={handleRegisterSubmit}
      className="flex w-full flex-col gap-6 text-left"
    >
      <h2 className="text-[20px] font-bold leading-tight text-[#303d51]">
        Review equipment details
      </h2>

      <section className="space-y-5 rounded-lg border border-[#f1e6e5] bg-white p-4 sm:p-6">
        <div className="grid w-full min-w-0 grid-cols-2 gap-4 lg:grid-cols-4">
          {summaryItems.map((item) => (
            <div key={item.label} className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#8994a5]">
                {item.label}
              </span>

              <span className="mt-1 block break-words text-xs font-semibold text-[#303d51]">
                {item.value || "—"}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 border-t border-[#f1e6e5] pt-5 sm:grid-cols-2">
          <div className="min-w-0">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#8994a5]">
              Allocation details
            </h3>

            <div className="space-y-3 text-xs">
              <SummaryRow label="Asset tag" value={formData.assetTag} />
              <SummaryRow label="Facility" value={formData.facilityName} />
              <SummaryRow label="Department" value={formData.department} />
              <SummaryRow label="Ward / room" value={formData.wardRoom} />
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#8994a5]">
              Specifications &amp; maintenance
            </h3>

            <div className="space-y-3 text-xs">
              <SummaryRow label="Power supply" value={formData.powerSupply} />
              <SummaryRow
                label="Installation date"
                value={formData.installationDate}
              />
              <SummaryRow label="Received at" value={formData.receivedAt} />

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[#8994a5]">Status:</span>

                <span className="inline-flex rounded-full border border-[#f1e6e5] bg-[#f8f6f3] px-2 py-1 text-[10px] font-bold text-[#39465a]">
                  {STATUS_LABELS[formData.status] || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#f1e6e5] pt-5">
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#8994a5]">
            Manufacturer information
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SummaryRow
              label="Manufacturer"
              value={formData.manufacturer || formData.make}
            />
            <SummaryRow
              label="Country of origin"
              value={formData.countryOfOrigin}
            />
            <SummaryRow label="Purchase date" value={formData.purchaseDate} />
            <SummaryRow
              label="Warranty expiry"
              value={formData.warrantyExpiry}
            />
          </div>

          {formData.description && (
            <div className="mt-4">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#8994a5]">
                Equipment description
              </span>

              <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-[#39465a]">
                {formData.description}
              </p>
            </div>
          )}
        </div>
      </section>

      {submitError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {submitError}
        </p>
      )}

      <div className="grid grid-cols-[0.8fr_1.4fr] gap-2 border-t border-[#f1e6e5] pt-4 pb-[calc(12px+env(safe-area-inset-bottom))] lg:flex lg:justify-end lg:gap-3 lg:border-0 lg:pb-0">
        <button
          type="button"
          onClick={prevStep}
          disabled={isSubmitting}
          className="h-[43px] w-full rounded-md border border-[#efcbd1] bg-white text-xs font-semibold text-[#8a1238] transition hover:bg-[#fff7f8] disabled:cursor-not-allowed disabled:opacity-50 lg:w-[114px]"
        >
          Back
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-[43px] w-full items-center justify-center gap-2 rounded-md bg-[#d99a00] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#bd8500] disabled:cursor-not-allowed disabled:opacity-60 lg:w-[184px]"
        >
          <span>
            {isSubmitting ? "Registering..." : "Complete registration"}
          </span>

          {!isSubmitting && (
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
          )}
        </button>
      </div>
    </form>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <p className="flex min-w-0 flex-wrap gap-x-1 break-words">
      <span className="text-[#8994a5]">{label}:</span>
      <span className="font-semibold text-[#303d51]">{value || "—"}</span>
    </p>
  );
}
