import enum

from sqlalchemy import Enum


class UserRole(str, enum.Enum):
    CLINICAL_STAFF = "clinical_staff"
    BIOMEDICAL_ENGINEER = "biomedical_engineer"
    HEALTH_MANAGER = "health_manager"


user_role_enum = Enum(
    UserRole,
    name="user_role",
    values_callable=lambda enum_class: [e.value for e in enum_class],
)


class AcquisitionType(str, enum.Enum):
    DONATED = "donated"
    PURCHASED = "purchased"
    TRANSFERRED = "transferred"
    UNKNOWN = "unknown"
    OTHER = "other"


class RegistrationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    RETURNED = "returned"


class InstallationStatus(str, enum.Enum):
    UNKNOWN = "unknown"
    NOT_INSTALLED = "not_installed"
    PARTIALLY_INSTALLED = "partially_installed"
    INSTALLED = "installed"
    COMMISSIONED = "commissioned"


class ServiceStatus(str, enum.Enum):
    NOT_ASSESSED = "not_assessed"
    IN_SERVICE = "in_service"
    OUT_OF_SERVICE = "out_of_service"
    UNDER_MAINTENANCE = "under_maintenance"
    NOT_INSTALLED = "not_installed"
    INCOMPLETE = "incomplete"
    RETIRED = "retired"


class DocumentType(str, enum.Enum):
    PHOTO = "photo"
    MANUAL = "manual"
    WARRANTY = "warranty"
    DONATION_LETTER = "donation_letter"
    DELIVERY_NOTE = "delivery_note"
    INSTALLATION_REPORT = "installation_report"
    CALIBRATION_CERTIFICATE = "calibration_certificate"
    OTHER = "other"


class FaultSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FaultStatus(str, enum.Enum):
    REPORTED = "reported"
    ASSIGNED = "assigned"
    UNDER_INSPECTION = "under_inspection"
    AWAITING_RESOURCES = "awaiting_resources"
    UNDER_REPAIR = "under_repair"
    AWAITING_VERIFICATION = "awaiting_verification"
    VERIFIED = "verified"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class PriorityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RecordType(str, enum.Enum):
    REPAIR = "repair"
    FUNCTIONAL_TEST = "functional_test"
    SAFETY_TEST = "safety_test"
    CALIBRATION = "calibration"
    PERFORMANCE_TEST = "performance_test"
    COMMISSIONING = "commissioning"
    RELEASE = "release"


class TestResult(str, enum.Enum):
    PASS = "pass"
    FAIL = "fail"
    NOT_PERFORMED = "not_performed"
    NOT_APPLICABLE = "not_applicable"


class RequestType(str, enum.Enum):
    SPARE_PARTS = "spare_parts"
    TECHNICAL_SUPPORT = "technical_support"
    REPLACEMENT_RESOURCE = "replacement_resource"
    NEW_EQUIPMENT = "new_equipment"


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETURNED = "returned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class NotificationType(str, enum.Enum):
    FAULT_REPORTED = "fault_reported"
    FAULT_ASSIGNED = "fault_assigned"
    FAULT_STATUS_CHANGED = "fault_status_changed"
    REGISTRATION_SUBMITTED = "registration_submitted"
    REGISTRATION_DECIDED = "registration_decided"
    REQUEST_SUBMITTED = "request_submitted"
    REQUEST_DECIDED = "request_decided"
    REQUEST_FOLLOW_UP_DUE = "request_follow_up_due"
    EQUIPMENT_RETURNED_TO_SERVICE = "equipment_returned_to_service"


class FollowUpChannel(str, enum.Enum):
    LETTER = "letter"
    EMAIL = "email"
    PHONE = "phone"
    IN_PERSON = "in_person"
    OTHER = "other"


class ReplyStatus(str, enum.Enum):
    NO_REPLY = "no_reply"
    ACCEPTED = "accepted"
    PARTLY = "partly"
    DECLINED = "declined"


class AuditEntityType(str, enum.Enum):
    USER = "user"
    DEPARTMENT = "department"
    EQUIPMENT = "equipment"
    EQUIPMENT_DOCUMENT = "equipment_document"
    FAULT = "fault"
    FAULT_ASSESSMENT = "fault_assessment"
    REPAIR_VERIFICATION_RECORD = "repair_verification_record"
    RESOURCE_REQUEST = "resource_request"
    NOTIFICATION = "notification"


def check_in(column_name, enum_class):
    """Builds the SQL text  column IN ('a', 'b', ...)  for a CheckConstraint."""
    allowed = ", ".join(f"'{e.value}'" for e in enum_class)
    return f"{column_name} IN ({allowed})"
