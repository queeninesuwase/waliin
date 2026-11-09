from datetime import timedelta, datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4
from pydantic import ValidationError

from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi import HTTPException
import pytest

from database import get_db
from models.enums import PriorityLevel, UserRole
from services.assessment_service import AssessmentService
from schemas.fault_assessment import FaultAssessmentCreate
from routers.fault_assessment import create_fault_assessment_router


@pytest.fixture
def service():
    return AssessmentService()


def test_history_factor_zero_with_no_faults(service):
    result = service.calculate_history_factor(
        fault_count=0,
        longest_downtime=None,
    )

    assert result == 0


def test_history_factor_one_with_one_fault(service):
    result = service.calculate_history_factor(
        fault_count=1,
        longest_downtime=timedelta(days=2),
    )

    assert result == 1


def test_history_factor_two_with_two_faults(service):
    result = service.calculate_history_factor(
        fault_count=2,
        longest_downtime=timedelta(days=2),
    )

    assert result == 2


def test_history_factor_two_when_downtime_over_seven_days(service):
    result = service.calculate_history_factor(
        fault_count=1,
        longest_downtime=timedelta(days=8),
    )

    assert result == 2


def test_history_factor_three_with_three_faults(service):
    result = service.calculate_history_factor(
        fault_count=3,
        longest_downtime=timedelta(days=2),
    )

    assert result == 3


def test_history_factor_three_when_downtime_over_thirty_days(service):
    result = service.calculate_history_factor(
        fault_count=1,
        longest_downtime=timedelta(days=31),
    )

    assert result == 3


def test_priority_score_with_backup(service):
    result = service.calculate_priority_score(
        severity_factor=2,
        clinical_criticality=2,
        backup_available=True,
        history_factor=1,
    )

    assert result == 5


def test_priority_score_without_backup(service):
    result = service.calculate_priority_score(
        severity_factor=2,
        clinical_criticality=2,
        backup_available=False,
        history_factor=1,
    )

    assert result == 7


@pytest.mark.parametrize(
    ("score", "expected"),
    [
        (2, PriorityLevel.LOW),
        (4, PriorityLevel.LOW),
        (5, PriorityLevel.MEDIUM),
        (7, PriorityLevel.MEDIUM),
        (8, PriorityLevel.HIGH),
        (9, PriorityLevel.HIGH),
        (10, PriorityLevel.CRITICAL),
        (12, PriorityLevel.CRITICAL),
    ],
)
def test_rule_priority_level_ranges(service, score, expected):
    result = service.calculate_rule_priority_level(
        severity_factor=1,
        clinical_criticality=1,
        backup_available=True,
        priority_score=score,
    )

    assert result == expected


def test_rule_priority_special_critical_case(service):
    result = service.calculate_rule_priority_level(
        severity_factor=4,
        clinical_criticality=3,
        backup_available=False,
        priority_score=9,
    )

    assert result == PriorityLevel.CRITICAL


def test_create_assessment_raises_404_when_fault_not_found():
    repository = MagicMock()
    repository.get_fault.return_value = None

    service = AssessmentService(repository=repository)

    db = MagicMock()
    fault_id = uuid4()
    engineer_id = uuid4()

    data = SimpleNamespace(
        findings="Power board damaged",
        condition="Out of service",
        recommended_action="Replace power board",
        severity_factor=4,
        clinical_criticality=3,
        backup_available=False,
        priority_level=PriorityLevel.CRITICAL,
        priority_explanation="Critical equipment with no backup",
    )

    with pytest.raises(HTTPException) as exc:
        service.create_assessment(
            db=db,
            fault_id=fault_id,
            assessed_by=engineer_id,
            data=data,
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "Fault not found"


def test_create_assessment_calculates_and_saves_values():
    repository = MagicMock()

    fault_id = uuid4()
    equipment_id = uuid4()
    engineer_id = uuid4()

    fault = SimpleNamespace(
        fault_id=fault_id,
        equipment_id=equipment_id,
    )

    repository.get_fault.return_value = fault
    repository.count_recent_equipment_faults.return_value = 2
    repository.get_longest_recent_downtime.return_value = timedelta(days=3)

    repository.create_assessment.side_effect = lambda db, assessment: assessment

    service = AssessmentService(repository=repository)
    db = MagicMock()

    data = SimpleNamespace(
        findings="Compressor failure",
        condition="Out of service",
        recommended_action="Replace compressor",
        severity_factor=3,
        clinical_criticality=2,
        backup_available=False,
        priority_level=PriorityLevel.HIGH,
        priority_explanation="High operational impact",
    )

    result = service.create_assessment(
        db=db,
        fault_id=fault_id,
        assessed_by=engineer_id,
        data=data,
    )

    assert result.history_factor == 2
    assert result.priority_score == 9
    assert result.rule_priority_level == PriorityLevel.HIGH.value
    assert result.priority_level == PriorityLevel.HIGH.value
    assert result.rule_version == "v1"
    assert result.is_current is True

    repository.clear_current_assessment.assert_called_once_with(
        db,
        fault_id,
    )

    repository.create_assessment.assert_called_once()

    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(result)


def test_create_assessment_clears_previous_current_assessment():
    repository = MagicMock()

    fault_id = uuid4()
    equipment_id = uuid4()
    engineer_id = uuid4()

    repository.get_fault.return_value = SimpleNamespace(
        fault_id=fault_id,
        equipment_id=equipment_id,
    )

    repository.count_recent_equipment_faults.return_value = 0
    repository.get_longest_recent_downtime.return_value = None

    service = AssessmentService(repository=repository)
    db = MagicMock()

    data = SimpleNamespace(
        findings="Minor sensor issue",
        condition="Operational with limitation",
        recommended_action="Replace sensor",
        severity_factor=1,
        clinical_criticality=1,
        backup_available=True,
        priority_level=PriorityLevel.LOW,
        priority_explanation="Low impact fault",
    )

    service.create_assessment(
        db=db,
        fault_id=fault_id,
        assessed_by=engineer_id,
        data=data,
    )

    repository.clear_current_assessment.assert_called_once_with(
        db,
        fault_id,
    )


def test_create_assessment_rolls_back_when_save_fails():
    repository = MagicMock()

    fault_id = uuid4()
    equipment_id = uuid4()
    engineer_id = uuid4()

    repository.get_fault.return_value = SimpleNamespace(
        fault_id=fault_id,
        equipment_id=equipment_id,
    )

    repository.count_recent_equipment_faults.return_value = 0
    repository.get_longest_recent_downtime.return_value = None
    repository.create_assessment.side_effect = RuntimeError("Database error")

    service = AssessmentService(repository=repository)
    db = MagicMock()

    data = SimpleNamespace(
        findings="Broken connector",
        condition="Out of service",
        recommended_action="Replace connector",
        severity_factor=2,
        clinical_criticality=2,
        backup_available=True,
        priority_level=PriorityLevel.LOW,
        priority_explanation="Assessment completed",
    )

    with pytest.raises(RuntimeError, match="Database error"):
        service.create_assessment(
            db=db,
            fault_id=fault_id,
            assessed_by=engineer_id,
            data=data,
        )

    db.rollback.assert_called_once()
    db.commit.assert_not_called()


def test_get_fault_assessments_returns_assessment_history():
    repository = MagicMock()

    fault_id = uuid4()

    repository.get_fault.return_value = SimpleNamespace(
        fault_id=fault_id,
        equipment_id=uuid4(),
    )

    assessments = [
        SimpleNamespace(assessment_id=uuid4()),
        SimpleNamespace(assessment_id=uuid4()),
    ]

    repository.get_assessments_for_fault.return_value = assessments

    service = AssessmentService(repository=repository)
    db = MagicMock()

    result = service.get_fault_assessments(
        db=db,
        fault_id=fault_id,
    )

    assert result == assessments

    repository.get_assessments_for_fault.assert_called_once_with(
        db=db,
        fault_id=fault_id,
    )


def test_get_fault_assessments_raises_404_when_fault_not_found():
    repository = MagicMock()
    repository.get_fault.return_value = None

    service = AssessmentService(repository=repository)

    with pytest.raises(HTTPException) as exc:
        service.get_fault_assessments(
            db=MagicMock(),
            fault_id=uuid4(),
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "Fault not found"


def test_assessment_schema_accepts_valid_input():
    data = FaultAssessmentCreate(
        findings="Compressor not starting",
        condition="Out of service",
        recommended_action="Inspect compressor",
        severity_factor=3,
        clinical_criticality=2,
        backup_available=False,
        priority_level=PriorityLevel.HIGH,
        priority_explanation="High service impact",
    )

    assert data.severity_factor == 3
    assert data.clinical_criticality == 2
    assert data.backup_available is False


@pytest.mark.parametrize("severity", [0, 5])
def test_assessment_schema_rejects_invalid_severity(severity):
    with pytest.raises(ValidationError):
        FaultAssessmentCreate(
            findings="Fault found",
            condition="Out of service",
            recommended_action="Repair",
            severity_factor=severity,
            clinical_criticality=2,
            backup_available=True,
            priority_level=PriorityLevel.MEDIUM,
            priority_explanation="Assessment completed",
        )


@pytest.mark.parametrize("criticality", [0, 4])
def test_assessment_schema_rejects_invalid_criticality(criticality):
    with pytest.raises(ValidationError):
        FaultAssessmentCreate(
            findings="Fault found",
            condition="Out of service",
            recommended_action="Repair",
            severity_factor=2,
            clinical_criticality=criticality,
            backup_available=True,
            priority_level=PriorityLevel.MEDIUM,
            priority_explanation="Assessment completed",
        )


@pytest.mark.parametrize(
    "field",
    [
        "findings",
        "condition",
        "recommended_action",
        "priority_explanation",
    ],
)
def test_assessment_schema_rejects_blank_text_fields(field):
    payload = {
        "findings": "Fault found",
        "condition": "Out of service",
        "recommended_action": "Repair",
        "severity_factor": 2,
        "clinical_criticality": 2,
        "backup_available": True,
        "priority_level": PriorityLevel.MEDIUM,
        "priority_explanation": "Assessment completed",
    }

    payload[field] = "   "

    with pytest.raises(ValidationError):
        FaultAssessmentCreate(**payload)


def test_assessment_schema_strips_text_fields():
    data = FaultAssessmentCreate(
        findings="  Compressor damaged  ",
        condition="  Out of service  ",
        recommended_action="  Replace compressor  ",
        severity_factor=3,
        clinical_criticality=2,
        backup_available=False,
        priority_level=PriorityLevel.HIGH,
        priority_explanation="  High operational impact  ",
    )

    assert data.findings == "Compressor damaged"
    assert data.condition == "Out of service"
    assert data.recommended_action == "Replace compressor"
    assert data.priority_explanation == "High operational impact"


def test_post_assessment_endpoint_returns_created_assessment():
    app = FastAPI()

    engineer_id = uuid4()
    fault_id = uuid4()
    assessment_id = uuid4()

    mock_engineer = SimpleNamespace(
        user_id=engineer_id,
        role=UserRole.BIOMEDICAL_ENGINEER,
    )

    mock_service = MagicMock()
    mock_service.create_assessment.return_value = SimpleNamespace(
        assessment_id=assessment_id,
        fault_id=fault_id,
        assessed_by=engineer_id,
        assessed_at=datetime.now(timezone.utc),
        findings="Compressor failure",
        condition="Out of service",
        recommended_action="Replace compressor",
        severity_factor=3,
        clinical_criticality=2,
        backup_available=False,
        history_factor=2,
        priority_score=9,
        rule_priority_level=PriorityLevel.HIGH,
        priority_level=PriorityLevel.HIGH,
        priority_explanation="High operational impact",
        rule_version="v1",
        is_current=True,
    )

    def mock_engineer_dependency():
        return mock_engineer

    def mock_db():
        yield MagicMock()

    router = create_fault_assessment_router(
        engineer_dependency=mock_engineer_dependency,
        service=mock_service,
    )

    app.include_router(router)
    app.dependency_overrides[get_db] = mock_db

    client = TestClient(app)

    response = client.post(
        f"/faults/{fault_id}/assessments",
        json={
            "findings": "Compressor failure",
            "condition": "Out of service",
            "recommended_action": "Replace compressor",
            "severity_factor": 3,
            "clinical_criticality": 2,
            "backup_available": False,
            "priority_level": "high",
            "priority_explanation": "High operational impact",
        },
    )

    assert response.status_code == 201
    body = response.json()

    assert body["fault_id"] == str(fault_id)
    assert body["assessed_by"] == str(engineer_id)
    assert body["priority_score"] == 9
    assert body["rule_priority_level"] == "high"
    assert body["priority_level"] == "high"


def test_get_assessments_endpoint_returns_history():
    app = FastAPI()

    engineer_id = uuid4()
    fault_id = uuid4()

    mock_engineer = SimpleNamespace(
        user_id=engineer_id,
        role=UserRole.BIOMEDICAL_ENGINEER,
    )

    mock_service = MagicMock()
    mock_service.get_fault_assessments.return_value = [
        SimpleNamespace(
            assessment_id=uuid4(),
            fault_id=fault_id,
            assessed_by=engineer_id,
            assessed_at=datetime.now(timezone.utc),
            findings="Initial inspection",
            condition="Out of service",
            recommended_action="Replace faulty board",
            severity_factor=3,
            clinical_criticality=2,
            backup_available=False,
            history_factor=1,
            priority_score=8,
            rule_priority_level=PriorityLevel.HIGH,
            priority_level=PriorityLevel.HIGH,
            priority_explanation="High impact",
            rule_version="v1",
            is_current=True,
        )
    ]

    def mock_engineer_dependency():
        return mock_engineer

    def mock_db():
        yield MagicMock()

    router = create_fault_assessment_router(
        engineer_dependency=mock_engineer_dependency,
        service=mock_service,
    )

    app.include_router(router)
    app.dependency_overrides[get_db] = mock_db

    client = TestClient(app)

    response = client.get(
        f"/faults/{fault_id}/assessments",
    )

    assert response.status_code == 200
    body = response.json()

    assert len(body) == 1
    assert body[0]["fault_id"] == str(fault_id)
    assert body[0]["priority_level"] == "high"
    assert body[0]["is_current"] is True
