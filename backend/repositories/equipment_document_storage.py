from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session


class EquipmentDocumentStorageRepository:
    """Handle PostgreSQL large-object persistence."""

    PREFIX = "pglo:"

    def __init__(self, db: Session):
        self.db = db

    def store(self, contents: bytes) -> str:
        oid = self.db.execute(
            text("SELECT lo_from_bytea(0, :contents)"),
            {"contents": contents},
        ).scalar_one()

        return f"{self.PREFIX}{oid}"

    def read(self, storage_key: str) -> bytes:
        oid = self._parse_key(storage_key)

        try:
            contents = self.db.execute(
                text("SELECT lo_get(CAST(:oid AS oid))"),
                {"oid": oid},
            ).scalar_one_or_none()
        except DBAPIError as exc:
            message = str(exc).lower()

            if "large object" in message and (
                "does not exist" in message or "could not open" in message
            ):
                raise FileNotFoundError("Stored document was not found.") from exc

            raise

        if contents is None:
            raise FileNotFoundError("Stored document was not found.")

        return bytes(contents)

    def delete(self, storage_key: str) -> None:
        oid = self._parse_key(storage_key)

        self.db.execute(
            text("SELECT lo_unlink(CAST(:oid AS oid))"),
            {"oid": oid},
        )

    @classmethod
    def _parse_key(cls, storage_key: str) -> int:
        if not storage_key.startswith(cls.PREFIX):
            raise ValueError("Unsupported document storage key.")

        value = storage_key[len(cls.PREFIX) :]

        if not value.isdecimal() or int(value) <= 0:
            raise ValueError("Invalid document storage key.")

        return int(value)
