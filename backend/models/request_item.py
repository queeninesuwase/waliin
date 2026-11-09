import uuid

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database import Base


class RequestItem(Base):
    """One item in a resource request: a spare part, an accessory or a piece of equipment.
    Each item is its own row, so items can be searched, checked and audited."""

    __tablename__ = "request_items"

    item_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    request_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "resource_requests.request_id", name="request_items_request_id_fkey"
        ),
        nullable=False,
    )
    item_name = Column(String(180), nullable=False)
    part_number = Column(
        String(80), nullable=True
    )  # manufacturer part number, if known
    specification = Column(
        Text, nullable=True
    )  # technical requirements, e.g. 220 V, 50 Hz
    unit = Column(String(30), nullable=True)  # e.g. piece, box
    quantity_requested = Column(Integer, nullable=False)
    quantity_approved = Column(Integer, nullable=True)  # set by the health manager
    quantity_fulfilled = Column(
        Integer, nullable=False, default=0, server_default=text("0")
    )

    __table_args__ = (
        CheckConstraint(
            "quantity_requested > 0", name="request_items_quantity_requested_check"
        ),
        CheckConstraint(
            "quantity_approved >= 0 AND quantity_approved <= quantity_requested",
            name="request_items_quantity_approved_check",
        ),
        CheckConstraint(
            "quantity_fulfilled >= 0", name="request_items_quantity_fulfilled_check"
        ),
        # Cannot receive more than was approved (when an approved quantity exists).
        CheckConstraint(
            "quantity_approved IS NULL OR quantity_fulfilled <= quantity_approved",
            name="ck_request_items_fulfilled_within_approved",
        ),
    )

    # Relationships
    request = relationship("ResourceRequest", back_populates="items")
