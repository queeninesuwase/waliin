from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from database import get_db
from models.enums import PriorityLevel, ServiceStatus
from models.fault import Fault
from models.fault_assessment import FaultAssessment
from repositories.dashboard_repository import DashboardRepository
from routers.dashboard import router
from services.dashboard_service import DashboardService


class FakeDashboardRepository(DashboardRepository):
    def count_active_faults(self, db):
        return 8

    def count_priority_faults(self, db, priority_level):
        if priority_level == PriorityLevel.CRITICAL:
            return 2

        if priority_level == PriorityLevel.HIGH:
            return 3

        return 0

    def count_equipment_by_service_status(self, db, service_status):
        if service_status == ServiceStatus.OUT_OF_SERVICE:
            return 4

        if service_status == ServiceStatus.UNDER_MAINTENANCE:
            return 2

        return 0


def test_dashboard_service_returns_summary():
    repository = FakeDashboardRepository()
    service = DashboardService(repository=repository)

    result = service.get_summary(db=None)

    assert result.active_faults == 8
    assert result.critical_faults == 2
    assert result.high_priority_faults == 3
    assert result.equipment_down == 4
    assert result.equipment_under_maintenance == 2


def test_dashboard_endpoint_returns_summary(monkeypatch):
    def fake_get_summary(self, db):
        return {
            "active_faults": 8,
            "critical_faults": 2,
            "high_priority_faults": 3,
            "equipment_down": 4,
            "equipment_under_maintenance": 2,
        }

    monkeypatch.setattr(
        "routers.dashboard.DashboardService.get_summary",
        fake_get_summary,
    )

    app = FastAPI()
    app.include_router(router)

    def override_get_db():
        yield None

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)

    response = client.get("/dashboard/summary")

    assert response.status_code == 200
    assert response.json() == {
        "active_faults": 8,
        "critical_faults": 2,
        "high_priority_faults": 3,
        "equipment_down": 4,
        "equipment_under_maintenance": 2,
    }


def test_repository_counts_active_faults(db, data):
    repository = DashboardRepository()

    closed_fault = Fault(
        equipment_id=data["machine"].equipment_id,
        reported_by=data["nurse"].user_id,
        description="Resolved fault",
        severity="low",
        status="closed",
        assigned_engineer_id=data["engineer"].user_id,
        closed_at=datetime.now(timezone.utc),
    )

    cancelled_fault = Fault(
        equipment_id=data["machine"].equipment_id,
        reported_by=data["nurse"].user_id,
        description="Cancelled fault",
        severity="low",
        status="cancelled",
        closed_at=datetime.now(timezone.utc),
    )

    db.add_all([closed_fault, cancelled_fault])
    db.flush()

    result = repository.count_active_faults(db)

    assert result == 1


def test_repository_counts_only_current_critical_assessment(db, data):
    repository = DashboardRepository()

    old_assessment = FaultAssessment(
        fault_id=data["fault"].fault_id,
        assessed_by=data["engineer"].user_id,
        findings="Previous assessment",
        condition="Out of service",
        recommended_action="Inspect equipment",
        severity_factor=4,
        clinical_criticality=3,
        backup_available=False,
        history_factor=1,
        priority_score=10,
        rule_priority_level="critical",
        priority_level="critical",
        priority_explanation="Previous critical assessment",
        rule_version="v1",
        is_current=False,
    )

    current_assessment = FaultAssessment(
        fault_id=data["fault"].fault_id,
        assessed_by=data["engineer"].user_id,
        findings="Current assessment",
        condition="Under repair",
        recommended_action="Continue repair",
        severity_factor=3,
        clinical_criticality=2,
        backup_available=True,
        history_factor=1,
        priority_score=8,
        rule_priority_level="high",
        priority_level="high",
        priority_explanation="Current high priority assessment",
        rule_version="v1",
        is_current=True,
    )

    db.add_all([old_assessment, current_assessment])
    db.flush()

    result = repository.count_priority_faults(
        db,
        PriorityLevel.CRITICAL,
    )

    assert result == 0


def test_repository_counts_current_high_priority_fault(db, data):
    repository = DashboardRepository()

    assessment = FaultAssessment(
        fault_id=data["fault"].fault_id,
        assessed_by=data["engineer"].user_id,
        findings="Compressor problem",
        condition="Under repair",
        recommended_action="Repair compressor",
        severity_factor=3,
        clinical_criticality=2,
        backup_available=True,
        history_factor=1,
        priority_score=8,
        rule_priority_level="high",
        priority_level="high",
        priority_explanation="High priority fault",
        rule_version="v1",
        is_current=True,
    )

    db.add(assessment)
    db.flush()

    result = repository.count_priority_faults(
        db,
        PriorityLevel.HIGH,
    )

    assert result == 1


def test_repository_counts_out_of_service_equipment(db, data):
    repository = DashboardRepository()

    data["machine"].service_status = "out_of_service"
    db.flush()

    result = repository.count_equipment_by_service_status(
        db,
        ServiceStatus.OUT_OF_SERVICE,
    )

    assert result == 1


def test_repository_counts_equipment_under_maintenance(db, data):
    repository = DashboardRepository()

    data["machine"].service_status = "under_maintenance"
    db.flush()

    result = repository.count_equipment_by_service_status(
        db,
        ServiceStatus.UNDER_MAINTENANCE,
    )

    assert result == 1
