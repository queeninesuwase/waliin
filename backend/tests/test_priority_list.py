from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient

from database import get_db
from repositories.priority_list_repository import PriorityListRepository
from routers.priority_list import router
from services.priority_list_service import PriorityListService


FAULT_ID = UUID("11111111-1111-1111-1111-111111111111")
EQUIPMENT_ID = UUID("22222222-2222-2222-2222-222222222222")
ENGINEER_ID = UUID("33333333-3333-3333-3333-333333333333")


def make_priority_row(
    priority_level: str = "critical",
    priority_score: int = 11,
):
    return {
        "fault_id": FAULT_ID,
        "equipment_id": EQUIPMENT_ID,
        "equipment_name": "Oxygen Concentrator",
        "asset_tag": "EQ-001",
        "department_name": "ICU",
        "fault_status": "under_repair",
        "priority_score": priority_score,
        "priority_level": priority_level,
        "priority_explanation": "Critical equipment with no backup available",
        "severity_factor": 4,
        "clinical_criticality": 3,
        "backup_available": False,
        "reported_at": datetime(2026, 10, 20, 8, 30, tzinfo=timezone.utc),
        "downtime": timedelta(hours=12),
        "still_down": True,
        "assigned_engineer_id": ENGINEER_ID,
    }


class FakePriorityListRepository(PriorityListRepository):
    def __init__(self, rows):
        self.rows = rows

    def get_priority_list(self, db):
        return self.rows


def test_priority_list_service_returns_items():
    repository = FakePriorityListRepository([make_priority_row()])
    service = PriorityListService(repository=repository)

    result = service.get_priority_list(db=None)

    assert len(result) == 1
    assert result[0].fault_id == FAULT_ID
    assert result[0].equipment_id == EQUIPMENT_ID
    assert result[0].equipment_name == "Oxygen Concentrator"
    assert result[0].asset_tag == "EQ-001"
    assert result[0].department_name == "ICU"
    assert result[0].priority_level == "critical"
    assert result[0].priority_score == 11


def test_priority_list_service_returns_empty_list():
    repository = FakePriorityListRepository([])
    service = PriorityListService(repository=repository)

    result = service.get_priority_list(db=None)

    assert result == []


def test_priority_list_item_contains_downtime_information():
    repository = FakePriorityListRepository([make_priority_row()])
    service = PriorityListService(repository=repository)

    result = service.get_priority_list(db=None)

    assert result[0].downtime == timedelta(hours=12)
    assert result[0].still_down is True


def test_priority_list_item_allows_missing_downtime():
    row = make_priority_row()
    row["downtime"] = None
    row["still_down"] = None

    repository = FakePriorityListRepository([row])
    service = PriorityListService(repository=repository)

    result = service.get_priority_list(db=None)

    assert result[0].downtime is None
    assert result[0].still_down is None


def test_priority_list_item_contains_assigned_engineer():
    repository = FakePriorityListRepository([make_priority_row()])
    service = PriorityListService(repository=repository)

    result = service.get_priority_list(db=None)

    assert result[0].assigned_engineer_id == ENGINEER_ID


def test_priority_list_endpoint_returns_priority_items(monkeypatch):
    rows = [make_priority_row()]

    def fake_get_priority_list(self, db):
        return rows

    monkeypatch.setattr(
        "routers.priority_list.PriorityListService.get_priority_list",
        fake_get_priority_list,
    )

    app = FastAPI()
    app.include_router(router)

    def override_get_db():
        yield None

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)

    response = client.get("/faults/priority-list")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["fault_id"] == str(FAULT_ID)
    assert data[0]["equipment_name"] == "Oxygen Concentrator"
    assert data[0]["priority_level"] == "critical"
    assert data[0]["priority_score"] == 11


def test_priority_list_endpoint_returns_empty_list(monkeypatch):
    def fake_get_priority_list(self, db):
        return []

    monkeypatch.setattr(
        "routers.priority_list.PriorityListService.get_priority_list",
        fake_get_priority_list,
    )

    app = FastAPI()
    app.include_router(router)

    def override_get_db():
        yield None

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)

    response = client.get("/faults/priority-list")

    assert response.status_code == 200
    assert response.json() == []
