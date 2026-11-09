import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

import repositories.session_repository as session_repository
from database import get_db
from main import app
from models import Fault
from repositories.session_repository import MemoryCache
from schemas.fault import FaultAssign, FaultCreate, FaultStatusUpdate
from security.login_limiter import login_limiter

NOW = datetime.now(timezone.utc)


@pytest.fixture
def client(db, monkeypatch):
    monkeypatch.setattr(session_repository, "cache", MemoryCache())
    app.dependency_overrides[get_db] = lambda: db
    login_limiter.clear()
    with TestClient(app, base_url="https://testserver") as test_client:
        yield test_client
    app.dependency_overrides.clear()
    login_limiter.clear()


def payload(data, **overrides):
    body = {
        "equipment_id": str(data["machine"].equipment_id),
        "reported_by": str(data["nurse"].user_id),
        "description": "Screen flickers",
        "severity": "high",
    }
    body.update(overrides)
    return body


@pytest.fixture
def reported_fault(db, data):
    """A brand new fault: status 'reported', nobody assigned yet."""
    fault = Fault(
        equipment_id=data["machine"].equipment_id,
        reported_by=data["nurse"].user_id,
        description="Pump alarm",
        severity="high",
    )
    db.add(fault)
    db.flush()
    db.refresh(fault)
    return fault


class TestCreateFault:
    def test_success(self, client, data):
        res = client.post("/faults/", json=payload(data))
        assert res.status_code == 201
        body = res.json()
        assert body["description"] == "Screen flickers"
        assert body["severity"] == "high"
        assert body["status"] == "reported"
        assert body["assigned_engineer_id"] is None
        assert body["assigned_engineer_role"] == "biomedical_engineer"
        assert body["reported_by"] == str(data["nurse"].user_id)
        assert body["equipment_id"] == str(data["machine"].equipment_id)
        assert body["closed_at"] is None
        assert body["fault_id"]

    def test_optional_fields_are_saved(self, client, data):
        report_id = str(uuid.uuid4())
        observed = (NOW - timedelta(hours=2)).isoformat()
        res = client.post(
            "/faults/",
            json=payload(
                data, client_report_id=report_id, failure_observed_at=observed
            ),
        )
        assert res.status_code == 201
        assert res.json()["client_report_id"] == report_id
        assert res.json()["failure_observed_at"] is not None

    def test_new_fault_is_visible_with_get(self, client, data):
        created = client.post("/faults/", json=payload(data)).json()
        res = client.get(f"/faults/{created['fault_id']}")
        assert res.status_code == 200
        assert res.json()["fault_id"] == created["fault_id"]

    @pytest.mark.parametrize(
        "missing", ["equipment_id", "reported_by", "description", "severity"]
    )
    def test_missing_required_field(self, client, data, missing):
        body = payload(data)
        body.pop(missing)
        res = client.post("/faults/", json=body)
        assert res.status_code == 422

    def test_empty_description(self, client, data):
        res = client.post("/faults/", json=payload(data, description=""))
        assert res.status_code == 422

    def test_invalid_severity(self, client, data):
        res = client.post("/faults/", json=payload(data, severity="extreme"))
        assert res.status_code == 422

    def test_invalid_equipment_uuid(self, client, data):
        res = client.post("/faults/", json=payload(data, equipment_id="not-a-uuid"))
        assert res.status_code == 422

    def test_invalid_reported_by_uuid(self, client, data):
        res = client.post("/faults/", json=payload(data, reported_by="123"))
        assert res.status_code == 422

    def test_empty_body(self, client):
        res = client.post("/faults/", json={})
        assert res.status_code == 422

    def test_no_body(self, client):
        res = client.post("/faults/")
        assert res.status_code == 422

    def test_unknown_equipment(self, client, data):
        with pytest.raises(IntegrityError):
            client.post("/faults/", json=payload(data, equipment_id=str(uuid.uuid4())))

    def test_unknown_reporter(self, client, data):
        with pytest.raises(IntegrityError):
            client.post("/faults/", json=payload(data, reported_by=str(uuid.uuid4())))

    def test_duplicate_client_report_id(self, client, data):
        report_id = str(uuid.uuid4())
        first = client.post("/faults/", json=payload(data, client_report_id=report_id))
        assert first.status_code == 201
        second = client.post("/faults/", json=payload(data, client_report_id=report_id))
        assert second.status_code == 409


class TestListFaults:
    def test_returns_existing_fault(self, client, data):
        res = client.get("/faults/")
        assert res.status_code == 200
        ids = [f["fault_id"] for f in res.json()]
        assert str(data["fault"].fault_id) in ids

    def test_returns_list_of_fault_objects(self, client, data):
        res = client.get("/faults/")
        item = res.json()[0]
        for key in (
            "fault_id",
            "equipment_id",
            "reported_by",
            "status",
            "severity",
        ):
            assert key in item

    def test_limit(self, client, data, reported_fault):
        res = client.get("/faults/", params={"limit": 1})
        assert res.status_code == 200
        assert len(res.json()) == 1

    def test_limit_zero(self, client, data):
        res = client.get("/faults/", params={"limit": 0})
        assert res.status_code == 200
        assert res.json() == []

    def test_skip_past_the_end(self, client, data):
        res = client.get("/faults/", params={"skip": 1000})
        assert res.status_code == 200
        assert res.json() == []

    def test_skip_and_limit_do_not_overlap(self, client, data, reported_fault):
        everything = client.get("/faults/").json()
        assert len(everything) >= 2
        first = client.get("/faults/", params={"skip": 0, "limit": 1}).json()
        second = client.get("/faults/", params={"skip": 1, "limit": 1}).json()
        assert len(first) == 1 and len(second) == 1
        assert first[0]["fault_id"] != second[0]["fault_id"]

    def test_invalid_skip_type(self, client):
        res = client.get("/faults/", params={"skip": "abc"})
        assert res.status_code == 422

    def test_invalid_limit_type(self, client):
        res = client.get("/faults/", params={"limit": "abc"})
        assert res.status_code == 422


class TestGetFault:
    def test_success(self, client, data):
        fault = data["fault"]
        res = client.get(f"/faults/{fault.fault_id}")
        assert res.status_code == 200
        body = res.json()
        assert body["fault_id"] == str(fault.fault_id)
        assert body["description"] == "No trace"
        assert body["severity"] == "high"
        assert body["status"] == "under_repair"
        assert body["assigned_engineer_id"] == str(data["engineer"].user_id)

    def test_not_found(self, client):
        res = client.get(f"/faults/{uuid.uuid4()}")
        assert res.status_code == 404
        assert res.json()["detail"] == "Fault not found"

    def test_invalid_uuid(self, client):
        res = client.get("/faults/not-a-uuid")
        assert res.status_code == 422


class TestAssignFault:
    def test_assign_moves_reported_to_assigned(self, client, data, reported_fault):
        body = {
            "assigned_engineer_id": str(data["engineer"].user_id),
            "assigned_engineer_role": "biomedical_engineer",
        }
        res = client.post(f"/faults/{reported_fault.fault_id}/assign", json=body)
        assert res.status_code == 200
        assert res.json()["status"] == "assigned"
        assert res.json()["assigned_engineer_id"] == str(data["engineer"].user_id)

    def test_assign_does_not_change_status_if_already_past_reported(self, client, data):
        fault = data["fault"]
        body = {
            "assigned_engineer_id": str(data["engineer"].user_id),
            "assigned_engineer_role": "biomedical_engineer",
        }
        res = client.post(f"/faults/{fault.fault_id}/assign", json=body)
        assert res.status_code == 200
        assert res.json()["status"] == "under_repair"

    def test_assign_fault_not_found(self, client, data):
        body = {
            "assigned_engineer_id": str(data["engineer"].user_id),
            "assigned_engineer_role": "biomedical_engineer",
        }
        res = client.post(f"/faults/{uuid.uuid4()}/assign", json=body)
        assert res.status_code == 404


class TestUpdateStatus:
    def test_update_status_success(self, client, data):
        fault = data["fault"]
        body = {
            "status": "under_inspection",
            "reason": "Engineer arrived",
            "out_of_service_at": (NOW - timedelta(hours=1)).isoformat(),
        }
        res = client.post(f"/faults/{fault.fault_id}/status", json=body)
        assert res.status_code == 200
        assert res.json()["status"] == "under_inspection"
        assert res.json()["out_of_service_at"] is not None

    def test_update_status_with_closed_at(self, client, data):
        fault = data["fault"]
        body = {"status": "closed", "closed_at": NOW.isoformat()}
        res = client.post(f"/faults/{fault.fault_id}/status", json=body)
        assert res.status_code == 200
        assert res.json()["status"] == "closed"
        assert res.json()["closed_at"] is not None

    def test_update_status_fault_not_found(self, client):
        body = {"status": "under_repair"}
        res = client.post(f"/faults/{uuid.uuid4()}/status", json=body)
        assert res.status_code == 404


class TestCloseFault:
    def test_close_fault_success(self, client, data, reported_fault):
        body_assign = {
            "assigned_engineer_id": str(data["engineer"].user_id),
            "assigned_engineer_role": "biomedical_engineer",
        }
        client.post(f"/faults/{reported_fault.fault_id}/assign", json=body_assign)

        body_close = {
            "reason": "Fixed power supply unit",
            "closed_at": NOW.isoformat(),
        }
        res = client.post(f"/faults/{reported_fault.fault_id}/close", json=body_close)
        assert res.status_code == 200
        assert res.json()["status"] == "closed"
        assert res.json()["closed_at"] is not None


def test_create_fault_database_integrity_exception_handling():
    from unittest.mock import MagicMock
    from services.fault import FaultService

    mock_repo = MagicMock()
    mock_repo.create.side_effect = Exception(
        "Unique constraint violation error occurred"
    )
    service = FaultService(fault_repo=mock_repo)
    fault_in = FaultCreate(
        description="Fails core layout",
        severity="high",
        equipment_id=uuid.uuid4(),
        reported_by=uuid.uuid4(),
    )
    with pytest.raises(HTTPException) as exc_info:
        service.create_fault(None, fault_in)
    assert exc_info.value.status_code == 409
    mock_repo.rollback.assert_called_once()


def test_create_fault_generic_exception_handling():
    from unittest.mock import MagicMock
    from services.fault import FaultService

    mock_repo = MagicMock()
    mock_repo.create.side_effect = Exception("Fatal engine disconnection")
    service = FaultService(fault_repo=mock_repo)
    fault_in = FaultCreate(
        description="Fails core layout",
        severity="high",
        equipment_id=uuid.uuid4(),
        reported_by=uuid.uuid4(),
    )
    with pytest.raises(Exception) as exc_info:
        service.create_fault(None, fault_in)
    assert "Fatal engine" in str(exc_info.value)
    mock_repo.rollback.assert_called_once()


def test_assign_fault_exception_handling():
    from unittest.mock import MagicMock
    from services.fault import FaultService

    mock_repo = MagicMock()
    mock_repo.get.return_value = MagicMock()
    mock_repo.update.return_value = MagicMock()
    mock_repo.commit.side_effect = Exception("DB update lock error")

    service = FaultService(fault_repo=mock_repo)
    body = FaultAssign(assigned_engineer_id=uuid.uuid4())
    with pytest.raises(Exception):
        service.assign_fault(None, uuid.uuid4(), body)
    mock_repo.rollback.assert_called_once()


def test_update_status_exception_handling():
    from unittest.mock import MagicMock
    from services.fault import FaultService

    mock_repo = MagicMock()
    mock_repo.get.return_value = MagicMock()
    mock_repo.update.return_value = MagicMock()
    mock_repo.commit.side_effect = Exception("DB status error")

    service = FaultService(fault_repo=mock_repo)
    body = FaultStatusUpdate(status="under_repair")
    with pytest.raises(Exception):
        service.update_status(None, uuid.uuid4(), body)
    mock_repo.rollback.assert_called_once()
