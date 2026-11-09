from models import AuditLog
from models.enums import AuditEntityType
from repositories import user_repository


def log_action(db, actor_user_id, action, entity_type, entity_id=None, details=None):
    """Add one audit row. The caller commits it together with the change it describes."""
    entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=AuditEntityType(entity_type).value,
        entity_id=entity_id,
        details=details,
    )
    return user_repository.add_audit_entry(db, entry)
