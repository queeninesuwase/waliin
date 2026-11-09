from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from main import app
from schemas.maintenance_report import MaintenanceReportSummary
from services.maintenance_report_service import MaintenanceReportService


class FakeMaintenanceReportRepository:
    def get_fault_summary(self, db):
        return {
            "total_faults": 10,
            "open_faults": 7,
            "closed_faults": 3,
        }

    def get_priority_breakdown(self, db):
        return {
            "critical": 2,
            "high": 3,
            "medium": 1,
            "low": 1,
        }

    def get_downtime_summary(self, db):
        return {
            "equipment_still_down": 4,
            "total_downtime": timedelta(hours=48),
            "average_downtime": timedelta(hours=12),
        }

    def get_repair_summary(self, db):
        return {
            "repairs_completed": 5,
            "equipment_returned_to_service": 4,
        }

    def get_resource_request_summary(self, db):
        return {
            "pending_requests": 2,
            "resolved_requests": 6,
        }

    def get_active_fault_details(self, db):
        return [
            {
                "fault_id": "40000000-0000-0000-0000-000000000001",
                "equipment_name": "Oxygen Concentrator",
                "asset_tag": "TEST-EQ-001",
                "department_name": "Biomedical Engineering",
                "fault_status": "under_inspection",
                "description": ("Equipment is not producing sufficient oxygen."),
                "reported_at": datetime(
                    2026,
                    10,
                    27,
                    8,
                    0,
                    tzinfo=timezone.utc,
                ),
                "priority_level": "critical",
                "priority_score": 11,
                "priority_explanation": (
                    "Critical equipment with no reliable backup available."
                ),
                "downtime": timedelta(hours=30),
                "still_down": True,
            },
            {
                "fault_id": "40000000-0000-0000-0000-000000000002",
                "equipment_name": "Patient Monitor",
                "asset_tag": "TEST-EQ-002",
                "department_name": "Emergency Department",
                "fault_status": "under_repair",
                "description": ("Monitor intermittently loses patient readings."),
                "reported_at": datetime(
                    2026,
                    10,
                    27,
                    9,
                    0,
                    tzinfo=timezone.utc,
                ),
                "priority_level": "high",
                "priority_score": 8,
                "priority_explanation": (
                    "High clinical importance with limited backup."
                ),
                "downtime": timedelta(hours=16),
                "still_down": True,
            },
        ]


class EmptyMaintenanceReportRepository:
    def get_fault_summary(self, db):
        return {
            "total_faults": 0,
            "open_faults": 0,
            "closed_faults": 0,
        }

    def get_priority_breakdown(self, db):
        return {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
        }

    def get_downtime_summary(self, db):
        return {
            "equipment_still_down": 0,
            "total_downtime": timedelta(),
            "average_downtime": timedelta(),
        }

    def get_repair_summary(self, db):
        return {
            "repairs_completed": 0,
            "equipment_returned_to_service": 0,
        }

    def get_resource_request_summary(self, db):
        return {
            "pending_requests": 0,
            "resolved_requests": 0,
        }

    def get_active_fault_details(self, db):
        return []


def test_service_returns_maintenance_summary():
    service = MaintenanceReportService(repository=FakeMaintenanceReportRepository())

    summary = service.get_summary(None)

    assert isinstance(summary, MaintenanceReportSummary)
    assert summary.faults.total_faults == 10
    assert summary.faults.open_faults == 7
    assert summary.faults.closed_faults == 3
    assert summary.priorities.critical == 2
    assert summary.priorities.high == 3
    assert summary.priorities.medium == 1
    assert summary.priorities.low == 1
    assert summary.downtime.equipment_still_down == 4
    assert summary.downtime.total_downtime == timedelta(hours=48)
    assert summary.downtime.average_downtime == timedelta(hours=12)
    assert summary.repairs.repairs_completed == 5
    assert summary.repairs.equipment_returned_to_service == 4
    assert summary.resource_requests.pending_requests == 2
    assert summary.resource_requests.resolved_requests == 6


def test_service_returns_zero_summary_when_no_data_exists():
    service = MaintenanceReportService(repository=EmptyMaintenanceReportRepository())

    summary = service.get_summary(None)

    assert summary.faults.total_faults == 0
    assert summary.faults.open_faults == 0
    assert summary.faults.closed_faults == 0
    assert summary.priorities.critical == 0
    assert summary.priorities.high == 0
    assert summary.priorities.medium == 0
    assert summary.priorities.low == 0
    assert summary.downtime.equipment_still_down == 0
    assert summary.downtime.total_downtime == timedelta()
    assert summary.downtime.average_downtime == timedelta()
    assert summary.repairs.repairs_completed == 0
    assert summary.repairs.equipment_returned_to_service == 0
    assert summary.resource_requests.pending_requests == 0
    assert summary.resource_requests.resolved_requests == 0


def test_service_generates_pdf():
    service = MaintenanceReportService(repository=FakeMaintenanceReportRepository())

    pdf_bytes = service.generate_pdf(None)

    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 100


def test_service_generates_pdf_with_empty_data():
    service = MaintenanceReportService(repository=EmptyMaintenanceReportRepository())

    pdf_bytes = service.generate_pdf(None)

    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 100


def test_format_duration():
    service = MaintenanceReportService(repository=FakeMaintenanceReportRepository())

    assert (
        service._format_duration(timedelta(days=2, hours=3, minutes=15))
        == "2 days 3 hours 15 minutes"
    )


def test_format_zero_duration():
    service = MaintenanceReportService(repository=FakeMaintenanceReportRepository())

    assert service._format_duration(timedelta()) == "0 hours"


def test_maintenance_summary_endpoint(monkeypatch):
    fake_service = MaintenanceReportService(
        repository=FakeMaintenanceReportRepository()
    )

    monkeypatch.setattr(
        "routers.maintenance_report.maintenance_report_service",
        fake_service,
    )

    client = TestClient(app)
    response = client.get("/reports/maintenance-summary")

    assert response.status_code == 200

    data = response.json()

    assert data["faults"]["total_faults"] == 10
    assert data["faults"]["open_faults"] == 7
    assert data["faults"]["closed_faults"] == 3

    assert data["priorities"]["critical"] == 2
    assert data["priorities"]["high"] == 3
    assert data["priorities"]["medium"] == 1
    assert data["priorities"]["low"] == 1

    assert data["downtime"]["equipment_still_down"] == 4

    assert data["repairs"]["repairs_completed"] == 5
    assert data["repairs"]["equipment_returned_to_service"] == 4

    assert data["resource_requests"]["pending_requests"] == 2
    assert data["resource_requests"]["resolved_requests"] == 6


def test_maintenance_summary_endpoint_returns_expected_sections(
    monkeypatch,
):
    fake_service = MaintenanceReportService(
        repository=FakeMaintenanceReportRepository()
    )

    monkeypatch.setattr(
        "routers.maintenance_report.maintenance_report_service",
        fake_service,
    )

    client = TestClient(app)
    response = client.get("/reports/maintenance-summary")

    data = response.json()

    assert set(data.keys()) == {
        "faults",
        "priorities",
        "downtime",
        "repairs",
        "resource_requests",
    }


def test_maintenance_summary_endpoint_handles_empty_data(monkeypatch):
    fake_service = MaintenanceReportService(
        repository=EmptyMaintenanceReportRepository()
    )

    monkeypatch.setattr(
        "routers.maintenance_report.maintenance_report_service",
        fake_service,
    )

    client = TestClient(app)
    response = client.get("/reports/maintenance-summary")

    assert response.status_code == 200

    data = response.json()

    assert data["faults"]["total_faults"] == 0
    assert data["priorities"]["critical"] == 0
    assert data["downtime"]["equipment_still_down"] == 0
    assert data["repairs"]["repairs_completed"] == 0
    assert data["resource_requests"]["pending_requests"] == 0


def test_maintenance_summary_pdf_endpoint(monkeypatch):
    fake_service = MaintenanceReportService(
        repository=FakeMaintenanceReportRepository()
    )

    monkeypatch.setattr(
        "routers.maintenance_report.maintenance_report_service",
        fake_service,
    )

    client = TestClient(app)
    response = client.get("/reports/maintenance-summary/pdf")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "waliin-maintenance-report.pdf" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")


def test_maintenance_summary_pdf_endpoint_has_content(monkeypatch):
    fake_service = MaintenanceReportService(
        repository=FakeMaintenanceReportRepository()
    )

    monkeypatch.setattr(
        "routers.maintenance_report.maintenance_report_service",
        fake_service,
    )

    client = TestClient(app)
    response = client.get("/reports/maintenance-summary/pdf")

    assert len(response.content) > 100
