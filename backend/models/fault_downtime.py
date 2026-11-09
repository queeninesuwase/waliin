from sqlalchemy import Boolean, Column, DateTime, Interval
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base

ViewBase = declarative_base()


class FaultDowntime(ViewBase):
    __tablename__ = "fault_downtime"

    fault_id = Column(UUID(as_uuid=True), primary_key=True)
    equipment_id = Column(UUID(as_uuid=True), nullable=False)
    out_of_service_at = Column(DateTime(timezone=True), nullable=False)
    released_at = Column(DateTime(timezone=True), nullable=True)
    downtime = Column(Interval, nullable=False)
    still_down = Column(Boolean, nullable=False)
