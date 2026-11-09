from io import BytesIO

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from schemas.maintenance_report import MaintenanceReportSummary
from services.maintenance_report_service import MaintenanceReportService

router = APIRouter(prefix="/reports", tags=["Maintenance Reports"])

maintenance_report_service = MaintenanceReportService()


@router.get(
    "/maintenance-summary",
    response_model=MaintenanceReportSummary,
)
def get_maintenance_summary(
    db: Session = Depends(get_db),
) -> MaintenanceReportSummary:
    return maintenance_report_service.get_summary(db)


@router.get("/maintenance-summary/pdf")
def download_maintenance_summary_pdf(
    db: Session = Depends(get_db),
) -> StreamingResponse:
    pdf_bytes = maintenance_report_service.generate_pdf(db)

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                'attachment; filename="waliin-maintenance-report.pdf"'
            )
        },
    )
