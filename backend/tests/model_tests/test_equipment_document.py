from models import EquipmentDocument
from models.enums import DocumentType


def new_document(data, **kw):
    values = dict(
        equipment_id=data["machine"].equipment_id,
        document_type="manual",
        document_name="User manual.pdf",
        storage_key="equipment/1/manual.pdf",
        uploaded_by=data["engineer"].user_id,
    )
    values.update(kw)
    return EquipmentDocument(**values)


def test_document_types_include_photo():
    assert "photo" in [d.value for d in DocumentType]


def test_document_type_is_checked(checks):
    assert "equipment_documents_document_type_check" in checks("equipment_documents")


def test_photo_document_is_saved(db, data):
    doc = new_document(data, document_type="photo", document_name="front.jpg")
    db.add(doc)
    db.flush()
    assert doc in data["machine"].documents


def test_bad_document_type_is_refused(db, data, refused):
    assert refused(lambda: db.add(new_document(data, document_type="video")))
