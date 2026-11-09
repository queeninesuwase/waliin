from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from models.department import Department
from models.equipment import Equipment
from models.equipment_document import EquipmentDocument
from models.notification import Notification
from models.enums import NotificationType
from schemas.equipment import (
    DepartmentCreate,
    DepartmentUpdate,
    EquipmentCreate,
    EquipmentUpdate,
)


class EquipmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def rollback(self) -> None:
        self.db.rollback()

    def create_department(self, schema_data: DepartmentCreate) -> Department:
        db_department = Department(
            **schema_data.model_dump(),
            responsible_engineer_role="biomedical_engineer",
        )

        try:
            self.db.add(db_department)
            self.db.commit()
            self.db.refresh(db_department)
            return db_department
        except Exception:
            self.db.rollback()
            raise

    def get_department_by_id(self, dept_id: UUID) -> Department | None:
        return (
            self.db.query(Department)
            .filter(Department.department_id == dept_id)
            .first()
        )

    def get_all_departments(self, active_only: bool = False) -> list[Department]:
        query = self.db.query(Department)

        if active_only:
            query = query.filter(Department.is_active.is_(True))

        return query.order_by(Department.department_name).all()

    def department_has_equipment(self, department_id: UUID) -> bool:
        return (
            self.db.query(Equipment)
            .filter(Equipment.department_id == department_id)
            .first()
            is not None
        )

    def update_department(
        self,
        db_department: Department,
        update_data: DepartmentUpdate,
    ) -> Department:
        changes = update_data.model_dump(exclude_unset=True)

        for key, value in changes.items():
            setattr(db_department, key, value)

        try:
            self.db.commit()
            self.db.refresh(db_department)
            return db_department
        except Exception:
            self.db.rollback()
            raise

    def deactivate_department(
        self,
        db_department: Department,
    ) -> Department:
        db_department.is_active = False

        try:
            self.db.commit()
            self.db.refresh(db_department)
            return db_department
        except Exception:
            self.db.rollback()
            raise

    def get_by_asset_tag(self, asset_tag: str) -> Equipment | None:
        return self.db.query(Equipment).filter(Equipment.asset_tag == asset_tag).first()

    def create_equipment(
        self, schema_data: EquipmentCreate, user_id: UUID
    ) -> Equipment:
        values = schema_data.model_dump()

        db_equipment = Equipment(
            **values,
            registration_status="pending",
            registered_by=user_id,
        )

        try:
            self.db.add(db_equipment)
            self.db.commit()
            self.db.refresh(db_equipment)
            return db_equipment
        except Exception:
            self.db.rollback()
            raise

    def get_equipment_by_id(self, equipment_id: UUID) -> Equipment | None:
        return (
            self.db.query(Equipment)
            .filter(Equipment.equipment_id == equipment_id)
            .first()
        )

    def list_all_equipment(self, approved_only: bool = False) -> list[Equipment]:
        query = self.db.query(Equipment)

        if approved_only:
            query = query.filter(Equipment.registration_status == "approved")

        return query.order_by(Equipment.created_at.desc()).all()

    def list_equipment_registered_by(self, user_id: UUID) -> list[Equipment]:
        return (
            self.db.query(Equipment)
            .filter(Equipment.registered_by == user_id)
            .order_by(Equipment.created_at.desc())
            .all()
        )

    def list_out_of_service_equipment(self) -> list[Equipment]:
        return (
            self.db.query(Equipment)
            .filter(Equipment.service_status == "out_of_service")
            .order_by(Equipment.created_at.desc())
            .all()
        )

    def list_pending_equipment(self) -> list[Equipment]:
        return (
            self.db.query(Equipment)
            .filter(Equipment.registration_status == "pending")
            .order_by(Equipment.created_at.asc())
            .all()
        )

    def resubmit_returned_equipment(
        self, db_equipment: Equipment, update_data: EquipmentUpdate
    ) -> Equipment:
        changes = update_data.model_dump(exclude_unset=True)
        for key, value in changes.items():
            setattr(db_equipment, key, value)

        db_equipment.registration_status = "pending"
        db_equipment.approved_by = None
        db_equipment.approved_at = None

        try:
            self.db.commit()
            self.db.refresh(db_equipment)
            return db_equipment
        except Exception:
            self.db.rollback()
            raise

    def update_equipment(
        self, db_equipment: Equipment, update_data: EquipmentUpdate
    ) -> Equipment:
        changes = update_data.model_dump(exclude_unset=True)

        for key, value in changes.items():
            setattr(db_equipment, key, value)

        try:
            self.db.commit()
            self.db.refresh(db_equipment)
            return db_equipment
        except Exception:
            self.db.rollback()
            raise

    def apply_approval(self, db_equipment: Equipment, manager_id: UUID) -> Equipment:
        db_equipment.registration_status = "approved"
        db_equipment.approved_by = manager_id
        db_equipment.approved_by_role = "health_manager"
        db_equipment.approved_at = datetime.now(timezone.utc)

        try:
            self.db.commit()
            self.db.refresh(db_equipment)
            return db_equipment
        except Exception:
            self.db.rollback()
            raise

    def apply_return(
        self, db_equipment: Equipment, reason: str | None = None
    ) -> Equipment:
        db_equipment.registration_status = "returned"

        message = "Your equipment registration was returned."
        if reason:
            message += f" Reason: {reason}"

        notification = Notification(
            recipient_user_id=db_equipment.registered_by,
            related_equipment_id=db_equipment.equipment_id,
            notification_type=NotificationType.REGISTRATION_DECIDED.value,
            message=message,
            channel="in_app",
        )

        try:
            self.db.add(notification)
            self.db.commit()
            self.db.refresh(db_equipment)
            return db_equipment
        except Exception:
            self.db.rollback()
            raise

    def create_document(
        self,
        equipment_id: UUID,
        doc_type: str,
        name: str,
        key: str,
        user_id: UUID,
    ) -> EquipmentDocument:
        db_document = EquipmentDocument(
            equipment_id=equipment_id,
            document_type=doc_type,
            document_name=name,
            storage_key=key,
            uploaded_by=user_id,
        )

        try:
            self.db.add(db_document)
            self.db.flush()
            self.db.refresh(db_document)
            return db_document
        except Exception:
            self.db.rollback()
            raise

    def get_document_by_id(self, doc_id: UUID) -> EquipmentDocument | None:
        return (
            self.db.query(EquipmentDocument)
            .filter(EquipmentDocument.document_id == doc_id)
            .first()
        )

    def delete_document(self, document: EquipmentDocument) -> None:
        self.db.delete(document)
        self.db.flush()

    def commit(self) -> None:
        self.db.commit()
