"""Tests for models/request_item.py (request_items table)."""

from models import RequestItem, ResourceRequest


def new_request(db, data):
    req = ResourceRequest(
        requested_by=data["engineer"].user_id,
        related_fault_id=data["fault"].fault_id,
        request_type="spare_parts",
        justification="Probe cable needed",
    )
    db.add(req)
    db.flush()
    return req


def new_item(req, **kw):
    values = dict(
        request_id=req.request_id,
        item_name="Probe cable",
        part_number="PC-12",
        quantity_requested=2,
    )
    values.update(kw)
    return RequestItem(**values)


def test_request_items_has_all_columns(table):
    assert set(table("request_items").c.keys()) == {
        "item_id",
        "request_id",
        "item_name",
        "part_number",
        "specification",
        "unit",
        "quantity_requested",
        "quantity_approved",
        "quantity_fulfilled",
    }


def test_request_item_constraints(checks, foreign_keys):
    assert {
        "request_items_quantity_requested_check",
        "request_items_quantity_approved_check",
        "request_items_quantity_fulfilled_check",
        "ck_request_items_fulfilled_within_approved",
    } <= checks("request_items")
    assert foreign_keys("request_items")["request_items_request_id_fkey"] == [
        "resource_requests.request_id"
    ]


def test_items_belong_to_their_request(db, data):
    req = new_request(db, data)
    db.add_all(
        [
            new_item(req),
            new_item(req, item_name="Battery", part_number=None, quantity_requested=1),
        ]
    )
    db.flush()
    db.refresh(req)
    assert {i.item_name for i in req.items} == {"Probe cable", "Battery"}


def test_new_item_starts_with_nothing_fulfilled(db, data):
    item = new_item(new_request(db, data))
    db.add(item)
    db.flush()
    db.refresh(item)
    assert item.quantity_fulfilled == 0 and item.quantity_approved is None


def test_quantity_zero_is_refused(db, data, refused):
    req = new_request(db, data)
    assert refused(lambda: db.add(new_item(req, quantity_requested=0)))


def test_approving_more_than_requested_is_refused(db, data, refused):
    req = new_request(db, data)
    assert refused(
        lambda: db.add(new_item(req, quantity_requested=2, quantity_approved=3))
    )


def test_approving_less_than_requested_is_allowed(db, data):
    req = new_request(db, data)
    db.add(new_item(req, quantity_requested=2, quantity_approved=1))
    db.flush()


def test_item_needs_an_existing_request(db, data, refused):
    import uuid

    assert refused(
        lambda: db.add(
            RequestItem(request_id=uuid.uuid4(), item_name="X", quantity_requested=1)
        )
    )


def test_receiving_more_than_approved_is_refused(db, data, refused):
    req = new_request(db, data)
    assert refused(
        lambda: db.add(
            new_item(
                req, quantity_requested=3, quantity_approved=2, quantity_fulfilled=3
            )
        )
    )


def test_receiving_up_to_approved_is_allowed(db, data):
    req = new_request(db, data)
    db.add(
        new_item(req, quantity_requested=3, quantity_approved=2, quantity_fulfilled=2)
    )
    db.flush()
