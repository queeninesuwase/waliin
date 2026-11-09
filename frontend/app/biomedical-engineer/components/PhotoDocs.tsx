"use client";

import React, { useRef, useState } from "react";
import { useFormState } from "../register-equipment/context/FormContext";
import { ApiError } from "@/lib/api/client";
import { uploadEquipmentDocument } from "@/lib/api/equipment";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PhotoDocs() {
  const { formData, setFormData, nextStep, prevStep } = useFormState();

  const documentInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const documents = formData.documents;
  const isCsv = formData.registrationMethod === "csv";

  // For CSV imports, users select which imported equipment
  // each document belongs to by asset tag.
  const assetTags = isCsv
    ? Array.from(
        new Set(
          formData.registeredEquipment
            .map((equipment) => equipment.assetTag)
            .filter(Boolean),
        ),
      )
    : [formData.assetTag].filter(Boolean);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;

    setError(null);

    const accepted = Array.from(fileList);
    const validFiles: Array<{
      id: string;
      file: File;
      assetTag: string;
    }> = [];
    const rejected: string[] = [];

    for (const file of accepted) {
      if (
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
      ) {
        rejected.push(`${file.name}: only PDF files are supported`);
        continue;
      }

      if (file.size === 0) {
        rejected.push(`${file.name}: the file is empty`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name}: file exceeds 10 MB`);
        continue;
      }

      validFiles.push({
        id: crypto.randomUUID(),
        file,
        assetTag: isCsv ? "" : formData.assetTag,
      });
    }

    if (validFiles.length > 0) {
      setFormData((previous) => ({
        ...previous,
        documents: [...previous.documents, ...validFiles],
      }));
    }

    if (rejected.length > 0) {
      setError(rejected.join(". "));
    }
  }

  function updateAssetTag(id: string, assetTag: string) {
    setFormData((previous) => ({
      ...previous,
      documents: previous.documents.map((document) =>
        document.id === id ? { ...document, assetTag } : document,
      ),
    }));
  }

  function removeDocument(id: string) {
    setFormData((previous) => ({
      ...previous,
      documents: previous.documents.filter((document) => document.id !== id),
    }));
  }

  async function handleContinue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUploading) return;

    setError(null);

    if (isCsv && documents.some((document) => !document.assetTag)) {
      setError(
        "Choose an equipment asset tag for each PDF, or remove documents you don't want to attach.",
      );
      return;
    }

    if (documents.length === 0) {
      nextStep();
      return;
    }

    setIsUploading(true);

    try {
      for (const document of documents) {
        if (document.uploadedDocumentId) continue;

        const equipment = isCsv
          ? formData.registeredEquipment.find(
              (item) => item.assetTag === document.assetTag,
            )
          : formData.registeredEquipment[0];

        if (!equipment?.equipmentId) {
          throw new Error(
            `No registered equipment was found for ${document.file.name}.`,
          );
        }

        const uploaded = await uploadEquipmentDocument(
          equipment.equipmentId,
          document.file,
          "other",
        );

        setFormData((previous) => ({
          ...previous,
          documents: previous.documents.map((item) =>
            item.id === document.id
              ? { ...item, uploadedDocumentId: uploaded.document_id }
              : item,
          ),
        }));
      }

      nextStep();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to upload documents. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleContinue} className="flex w-full flex-col text-left">
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-x-10">
        <section className="flex min-w-0 flex-col gap-4">
          <h2 className="text-[20px] font-bold leading-tight text-[#303d51]">
            Equipment documents
          </h2>

          <p className="text-xs leading-5 text-[#8994a5]">
            Add PDF manuals, warranty certificates, inspection reports, or other
            documents for your equipment.
          </p>

          <button
            type="button"
            onClick={() => documentInputRef.current?.click()}
            className="flex min-h-36 w-full flex-col items-center justify-center rounded-lg border border-dashed border-[#efb8c2] bg-white p-5 transition hover:bg-[#fff7f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c59124]"
          >
            <span
              className="text-2xl font-semibold text-[#c59124]"
              aria-hidden="true"
            >
              ↑
            </span>

            <span className="mt-2 text-xs font-semibold text-[#8a1238]">
              Select PDF documents
            </span>

            <span className="mt-1 text-[10px] text-[#8994a5]">
              PDF only · Maximum 10 MB per file
            </span>
          </button>
        </section>

        <section className="flex min-w-0 flex-col gap-4">
          <h2 className="text-[20px] font-bold leading-tight text-[#303d51]">
            Selected documents ({documents.length})
          </h2>

          {documents.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-[#efb8c2] bg-white p-4 text-center text-xs text-[#8994a5]">
              No documents selected yet
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="min-w-0 space-y-3 rounded-md border border-[#f1e6e5] bg-white p-3"
                >
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="shrink-0 rounded-md bg-[#fff7f8] px-2 py-1 text-xs font-bold text-[#8a1238]">
                        PDF
                      </span>

                      <div className="min-w-0">
                        <p className="break-words text-xs font-medium text-[#39465a]">
                          {document.file.name}
                        </p>
                        <p className="mt-1 text-[10px] text-[#8994a5]">
                          {formatFileSize(document.file.size)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeDocument(document.id)}
                      aria-label={`Remove ${document.file.name}`}
                      className="min-h-9 min-w-9 shrink-0 rounded-md text-sm text-[#8a1238] transition hover:bg-[#fff7f8]"
                    >
                      ✕
                    </button>
                  </div>

                  {isCsv ? (
                    <div>
                      <label
                        htmlFor={`asset-tag-${document.id}`}
                        className="mb-1 block text-[10px] text-[#8994a5]"
                      >
                        Attach to equipment asset tag *
                      </label>

                      {assetTags.length > 0 ? (
                        <select
                          id={`asset-tag-${document.id}`}
                          value={document.assetTag}
                          onChange={(event) =>
                            updateAssetTag(document.id, event.target.value)
                          }
                          required
                          className="h-[39px] w-full rounded-md border border-[#efb8c2] bg-white px-2 text-xs text-[#39465a] outline-none focus:border-[#c59124]"
                        >
                          <option value="">Select asset tag</option>
                          {assetTags.map((tag) => (
                            <option key={tag} value={tag}>
                              {tag}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-amber-700">
                          No imported equipment asset tags are available yet.
                          Import the CSV and load its equipment list before
                          attaching documents.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-[#8994a5]">
                      Equipment asset tag: {formData.assetTag || "Not set"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 break-words rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-8 grid grid-cols-[0.8fr_1.4fr] gap-2 border-t border-[#f1e6e5] pt-4 pb-[calc(12px+env(safe-area-inset-bottom))] lg:flex lg:justify-end lg:gap-3 lg:border-0 lg:pb-0">
        <button
          type="button"
          onClick={prevStep}
          className="h-[43px] w-full rounded-md border border-[#efcbd1] bg-white text-xs font-semibold text-[#8a1238] transition hover:bg-[#fff7f8] lg:w-[114px]"
        >
          Back
        </button>

        <button
          type="submit"
          className="flex h-[43px] w-full items-center justify-center gap-2 rounded-md bg-[#d99a00] px-4 text-xs font-semibold text-white transition hover:bg-[#bd8500] lg:w-[184px]"
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
