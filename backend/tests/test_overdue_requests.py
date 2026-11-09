from datetime import date
from types import SimpleNamespace

from services import resource_requests_service as service


def test_overdue_passes_today_to_the_repository(monkeypatch):
    calls = []

    def fake_get_overdue(db, today):
        calls.append(today)
        return [SimpleNamespace(request_id="r1"), SimpleNamespace(request_id="r1")]

    monkeypatch.setattr(service.follow_ups_repo, "get_overdue", fake_get_overdue)
    monkeypatch.setattr(service, "get_request", lambda db, rid: {"request_id": rid})

    assert service.get_overdue(None) == [{"request_id": "r1"}]
    assert calls == [date.today()]


def test_overdue_is_empty_when_nothing_is_late(monkeypatch):
    monkeypatch.setattr(service.follow_ups_repo, "get_overdue", lambda db, today: [])

    assert service.get_overdue(None) == []
