"use client";

import React, { createContext, useContext, useState } from "react";

export type RegistrationMethod = "manual" | "csv";

export interface RegisteredEquipment {
  equipmentId: string;
  assetTag: string;
  manufacturer: string;
  modelName: string;
}

export interface SelectedEquipmentDocument {
  id: string;
  file: File;
  assetTag: string;
  uploadedDocumentId?: string;
}

export interface EquipmentFormData {
  registrationMethod: RegistrationMethod | null;
  csvFile: File | null;
  registeredEquipment: RegisteredEquipment[];

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

  facilityName: string;
  department: string;
  departmentId: string;
  wardRoom: string;
  powerSupply: string;
  installationDate: string;
  status: string;

  photos: string[];
  documents: SelectedEquipmentDocument[];
}

interface FormContextType {
  currentStep: number;
  maxReachedStep: number;
  formData: EquipmentFormData;
  setFormData: React.Dispatch<React.SetStateAction<EquipmentFormData>>;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  advanceToStep: (step: number) => void;
  resetForm: () => void;
}

const TOTAL_STEPS = 6;

const createInitialData = (): EquipmentFormData => ({
  registrationMethod: null,
  csvFile: null,
  registeredEquipment: [],

  equipmentType: "",
  make: "",
  model: "",
  serialNumber: "",
  assetTag: "",
  receivedAt: "",

  description: "",
  manufacturer: "",
  countryOfOrigin: "",
  purchaseDate: "",
  warrantyExpiry: "",

  facilityName: "",
  department: "",
  departmentId: "",
  wardRoom: "",
  powerSupply: "",
  installationDate: "",
  status: "",

  photos: [],
  documents: [],
});

const FormContext = createContext<FormContextType | undefined>(undefined);

export function FormProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [maxReachedStep, setMaxReachedStep] = useState(1);
  const [formData, setFormData] =
    useState<EquipmentFormData>(createInitialData);

  const advanceToStep = (step: number) => {
    if (
      !Number.isInteger(step) ||
      step < 1 ||
      step > TOTAL_STEPS ||
      currentStep === TOTAL_STEPS
    ) {
      return;
    }

    setCurrentStep(step);
    setMaxReachedStep((previous) => Math.max(previous, step));
  };

  const nextStep = () => {
    advanceToStep(Math.min(currentStep + 1, TOTAL_STEPS));
  };

  const prevStep = () => {
    setCurrentStep((previous) => Math.max(previous - 1, 1));
  };

  const goToStep = (step: number) => {
    if (
      Number.isInteger(step) &&
      step >= 1 &&
      step <= maxReachedStep &&
      currentStep !== TOTAL_STEPS
    ) {
      setCurrentStep(step);
    }
  };

  const resetForm = () => {
    setFormData(createInitialData());
    setCurrentStep(1);
    setMaxReachedStep(1);
  };

  return (
    <FormContext.Provider
      value={{
        currentStep,
        maxReachedStep,
        formData,
        setFormData,
        nextStep,
        prevStep,
        goToStep,
        advanceToStep,
        resetForm,
      }}
    >
      {children}
    </FormContext.Provider>
  );
}

export function useFormState() {
  const context = useContext(FormContext);

  if (!context) {
    throw new Error("useFormState must be used within a FormProvider");
  }

  return context;
}
