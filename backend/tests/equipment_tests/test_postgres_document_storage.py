from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import DBAPIError

from repositories.equipment_document_storage import EquipmentDocumentStorageRepository


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def storage(db):
    return EquipmentDocumentStorageRepository(db)


def test_store_returns_prefixed_large_object_id(storage, db):
    db.execute.return_value.scalar_one.return_value = 12345

    key = storage.store(b"sample document")

    assert key == "pglo:12345"
    db.execute.assert_called_once()


def test_read_returns_bytes(storage, db):
    db.execute.return_value.scalar_one_or_none.return_value = b"document bytes"

    contents = storage.read("pglo:12345")

    assert contents == b"document bytes"
    db.execute.assert_called_once()


def test_read_missing_large_object_raises_file_not_found(storage, db):
    db.execute.side_effect = DBAPIError(
        "SELECT lo_get(...)",
        {},
        Exception("large object 12345 does not exist"),
    )

    with pytest.raises(FileNotFoundError):
        storage.read("pglo:12345")


def test_read_propagates_unrelated_database_error(storage, db):
    db.execute.side_effect = DBAPIError(
        "SELECT lo_get(...)",
        {},
        Exception("database connection lost"),
    )

    with pytest.raises(DBAPIError):
        storage.read("pglo:12345")


def test_read_rejects_invalid_storage_key(storage, db):
    with pytest.raises(ValueError):
        storage.read("invalid-key")

    db.execute.assert_not_called()


@pytest.mark.parametrize("key", ["pglo:0", "pglo:-1", "pglo:abc", "pglo:"])
def test_parse_key_rejects_invalid_values(key):
    with pytest.raises(ValueError):
        EquipmentDocumentStorageRepository._parse_key(key)


def test_parse_key_returns_oid():
    assert EquipmentDocumentStorageRepository._parse_key("pglo:12345") == 12345


def test_delete_calls_large_object_unlink(storage, db):
    storage.delete("pglo:12345")

    db.execute.assert_called_once()
