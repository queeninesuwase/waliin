"use client";

import { useState } from "react";
import AssessmentForm from "./AssessmentForm";
import AssessmentHistory from "./AssessmentHistory";

type AssessmentPanelProps = {
  faultId: string;
  engineerId: string;
  onSaved?: () => void;
};

export default function AssessmentPanel({
  faultId,
  engineerId,
  onSaved,
}: AssessmentPanelProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  function handleAssessmentSaved() {
    setRefreshKey((current) => current + 1);
    onSaved?.();
  }

  return (
    <>
      <AssessmentForm
        faultId={faultId}
        engineerId={engineerId}
        onAssessmentSaved={handleAssessmentSaved}
      />

      <div className="mt-6">
        <AssessmentHistory
          faultId={faultId}
          engineerId={engineerId}
          refreshKey={refreshKey}
        />
      </div>
    </>
  );
}
