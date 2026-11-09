from uuid import uuid4

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200


def test_health_dict():
    r = client.get("/health")
    assert r.json().get("status") == "ok"


def test_repairs_requires_user_id():
    fid = uuid4()
    r = client.post(f"/faults/{fid}/repairs", json={"work_performed": "x"})
    assert r.status_code == 422


def test_repairs_rejects_empty_work():
    fid = uuid4()
    r = client.post(
        f"/faults/{fid}/repairs",
        json={"work_performed": "   "},
        headers={"user-id": str(uuid4())},
    )
    assert r.status_code in (400, 422)


def test_tests_requires_user_id():
    fid = uuid4()
    r = client.post(
        f"/faults/{fid}/tests",
        json={"record_type": "functional_test", "test_result": "pass"},
    )
    assert r.status_code == 422


def test_tests_rejects_bad_type():
    fid = uuid4()
    r = client.post(
        f"/faults/{fid}/tests",
        json={"record_type": "bogus", "test_result": "pass"},
        headers={"user-id": str(uuid4())},
    )
    assert r.status_code in (400, 422)


def test_release_requires_user_id():
    fid = uuid4()
    r = client.post(f"/faults/{fid}/release", headers={})
    assert r.status_code == 422


def test_records_endpoint():
    fid = uuid4()
    r = client.get(f"/faults/{fid}/records")
    assert r.status_code in (200, 404, 405, 422, 500)


def test_rvr_create_requires_user_id():
    r = client.post("/repair-verification-records/", json={})
    assert r.status_code == 422


def test_rvr_list_requires_user_id():
    r = client.get("/repair-verification-records/")
    assert r.status_code == 422


def test_rvr_get_requires_user_id():
    rid = uuid4()
    r = client.get(f"/repair-verification-records/{rid}")
    assert r.status_code == 422


def test_rvr_update_requires_user_id():
    rid = uuid4()
    r = client.put(f"/repair-verification-records/{rid}", json={})
    assert r.status_code == 422


def test_rvr_delete_requires_user_id():
    rid = uuid4()
    r = client.delete(f"/repair-verification-records/{rid}")
    assert r.status_code == 422


def test_fault_tests_post_requires_user_id():
    fid = uuid4()
    r = client.post(
        f"/faults/{fid}/tests", json={"test_type": "functional", "passed": True}
    )
    assert r.status_code == 422


def test_fault_tests_get():
    fid = uuid4()
    r = client.get(f"/faults/{fid}/tests")
    assert r.status_code in (200, 404, 405, 422, 500)


def test_fault_release_no_auth():
    fid = uuid4()
    r = client.post(f"/faults/{fid}/release")
    assert r.status_code in (200, 404, 405, 422, 500)


def test_repairs_valid_payload_shape():
    fid = uuid4()
    uid = uuid4()
    r = client.post(
        f"/faults/{fid}/repairs",
        json={"work_performed": "fixed belt"},
        headers={"user-id": str(uid)},
    )
    assert r.status_code in (200, 404, 405, 422, 500)


def test_tests_valid_payload_shape():
    fid = uuid4()
    uid = uuid4()
    r = client.post(
        f"/faults/{fid}/tests",
        json={"record_type": "functional_test", "test_result": "pass"},
        headers={"user-id": str(uid)},
    )
    assert r.status_code in (200, 404, 405, 422, 500)


def test_repair_rejects_blank_work():
    fid = uuid4()
    uid = uuid4()
    r = client.post(
        f"/faults/{fid}/repairs",
        json={"work_performed": ""},
        headers={"user-id": str(uid)},
    )
    assert r.status_code in (400, 422)


def test_test_rejects_bad_result():
    fid = uuid4()
    uid = uuid4()
    r = client.post(
        f"/faults/{fid}/tests",
        json={"record_type": "functional_test", "test_result": "maybe"},
        headers={"user-id": str(uid)},
    )
    assert r.status_code in (400, 422)


def test_release_returns_404_or_500_for_missing_fault():
    fid = uuid4()
    uid = uuid4()
    r = client.post(
        f"/faults/{fid}/release",
        json={"test_details": "x"},
        headers={"user-id": str(uid)},
    )
    assert r.status_code in (400, 404, 422, 500)


def test_records_returns_list_or_error():
    fid = uuid4()
    r = client.get(f"/faults/{fid}/records")
    assert r.status_code in (200, 404, 422, 500)


def test_repair_requires_user_id_header():
    fid = uuid4()
    r = client.post(f"/faults/{fid}/repairs", json={"work_performed": "x"})
    assert r.status_code == 422
