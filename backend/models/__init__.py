from database import Base
from models.enums import UserRole
from models.user import User
from models.department import Department
from models.equipment import Equipment
from models.equipment_document import EquipmentDocument
from models.fault import Fault
from models.fault_status_history import FaultStatusHistory
from models.fault_assessment import FaultAssessment
from models.repair_verification_record import RepairVerificationRecord
from models.resource_request import ResourceRequest
from models.request_item import RequestItem
from models.request_follow_up import RequestFollowUp
from models.notification import Notification
from models.audit_log import AuditLog
from models.fault_downtime import FaultDowntime  # view (read-only)


__all__ = [
    "Base",
    "UserRole",
    "User",
    "Department",
    "Equipment",
    "EquipmentDocument",
    "Fault",
    "FaultStatusHistory",
    "FaultAssessment",
    "RepairVerificationRecord",
    "ResourceRequest",
    "RequestItem",
    "RequestFollowUp",
    "Notification",
    "AuditLog",
    "FaultDowntime",
]
