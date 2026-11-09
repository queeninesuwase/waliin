"use client";

import React, { useRef, useState } from "react";
import { useFormState } from "../register-equipment/context/FormContext";
import {
  importEquipmentCsv,
  type CsvImportResponse,
} from "@/lib/api/equipment";
import { ApiError } from "@/lib/api/client";

export default function CsvEquipmentImport() {
  const { setFormData, advanceToStep } = useFormState();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CsvImportResponse | null>(null);
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;

    setFile(null);
    setResult(null);
    setError("");

    if (!selectedFile) {
      setFormData((previous) => ({
        ...previous,
        csvFile: null,
      }));
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a .csv file.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size === 0) {
      setError("The selected CSV file is empty.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("The CSV file must be 10 MB or smaller.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);

    setFormData((previous) => ({
      ...previous,
      registrationMethod: "csv",
      csvFile: selectedFile,
    }));
  }

  async function handleImport() {
    if (!file || isImporting) return;

    setIsImporting(true);
    setError("");
    setResult(null);

    try {
      const response = await importEquipmentCsv(file);

      setResult(response);

      setFormData((previous) => ({
        ...previous,
        registeredEquipment: (response.imported_equipment ?? []).map(
          (equipment) => ({
            equipmentId: equipment.equipment_id,
            assetTag: equipment.asset_tag,
            manufacturer: equipment.manufacturer,
            modelName: equipment.model_name,
          }),
        ),
      }));

      if (response.imported_count > 0 && response.errors.length === 0) {
        // Step 5 is the shared PDF upload step.
        advanceToStep(5);
      } else if (response.imported_count === 0) {
        setError("No equipment was imported. Review the row errors below.");
      } else {
        setError(
          "Some equipment was imported, but some rows failed. Review the errors below before continuing.",
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "The CSV import failed. Please try again.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  function handleImportAnotherFile() {
    setFile(null);
    setResult(null);
    setError("");

    setFormData((previous) => ({
      ...previous,
      csvFile: null,
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-12">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          Bulk registration
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          Import equipment from CSV
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Upload a CSV file to register multiple equipment records. The backend
          will report any rows it cannot import.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 lg:p-8">
        <label
          htmlFor="equipment-csv"
          className="mb-2 block text-sm font-medium text-slate-800"
        >
          Select CSV file
        </label>

        <input
          ref={fileInputRef}
          id="equipment-csv"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          disabled={isImporting}
          className="block w-full cursor-pointer text-sm text-slate-700 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-100 file:px-4 file:py-2 file:font-semibold file:text-amber-900 hover:file:bg-amber-200 disabled:opacity-60"
        />

        <p className="mt-3 text-xs text-slate-500">CSV only · Maximum 10 MB</p>

        {file && (
          <p className="mt-3 break-all text-sm text-slate-700">
            Selected: <strong>{file.name}</strong>
          </p>
        )}
      </div>

      <div className="mt-6 rounded-xl bg-slate-50 p-4 lg:p-6">
        <h3 className="text-sm font-semibold text-slate-800">
          Required CSV columns
        </h3>

        <p className="mt-2 break-words text-sm leading-6 text-slate-600">
          manufacturer, model_name, equipment_category, department_id,
          asset_tag, location
        </p>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          Column names must match these fields. Each department_id must be a
          valid UUID for an existing active department.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {result && (
        <div
          aria-live="polite"
          className="mt-5 rounded-xl border border-slate-200 p-4"
        >
          <h3 className="font-semibold text-slate-900">Import results</h3>

          <p className="mt-2 text-sm text-slate-700">
            Successfully imported: <strong>{result.imported_count}</strong>
          </p>

          <p className="mt-1 text-sm text-slate-700">
            Rows with errors: <strong>{result.errors.length}</strong>
          </p>

          {result.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 text-sm font-semibold text-red-700">
                Rows that need attention
              </h4>

              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {result.errors.map((item, index) => (
                  <li
                    key={`${item.row_number}-${index}`}
                    className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
                  >
                    <strong>Row {item.row_number}:</strong> {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={handleImportAnotherFile}
            disabled={isImporting}
            className="mt-5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Import another file
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleImport}
        disabled={!file || isImporting || result !== null}
        className="mt-8 w-full rounded-xl bg-amber-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isImporting ? "Importing CSV..." : "Import equipment"}
      </button>
    </section>
  );
}
