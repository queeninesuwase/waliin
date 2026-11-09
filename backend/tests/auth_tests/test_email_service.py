import pytest

from config import settings
from services import email_service
from services.email_service import EmailError


def test_invitation_email_has_the_link_and_expiry(emails, monkeypatch):
    monkeypatch.setattr(settings, "frontend_base_url", "https://waliin.example")
    email_service.send_invitation_email("tigist@hospital.et", "raw-token-123", 72)
    message = emails[0]
    assert message["To"] == "tigist@hospital.et"
    assert message["Subject"] == "Your Waliin invitation"
    body = plain_text(message)
    assert "https://waliin.example/accept-invite?token=raw-token-123" in body
    assert "72 hours" in body


def test_invitation_email_has_a_designed_html_version(emails, monkeypatch):
    monkeypatch.setattr(settings, "frontend_base_url", "https://waliin.example")
    email_service.send_invitation_email("tigist@hospital.et", "raw-token-123", 72)
    page = html_text(emails[0])
    assert "Accept invitation" in page
    assert 'href="https://waliin.example/accept-invite?token=raw-token-123"' in page
    assert "72 hours" in page


def plain_text(message):
    return message.get_body(preferencelist=("plain",)).get_content()


def html_text(message):
    return message.get_body(preferencelist=("html",)).get_content()


def test_reset_email_has_the_link_and_expiry(emails, monkeypatch):
    monkeypatch.setattr(settings, "frontend_base_url", "https://waliin.example")
    email_service.send_password_reset_email("tigist@hospital.et", "raw-token-123", 5)
    body = plain_text(emails[0])
    assert "https://waliin.example/reset-password/raw-token-123" in body
    assert "5 minutes" in body


def test_reset_email_has_a_designed_html_version(emails, monkeypatch):
    monkeypatch.setattr(settings, "frontend_base_url", "https://waliin.example")
    monkeypatch.setattr(settings, "email_logo_url", "https://cdn.example/logo.png")
    email_service.send_password_reset_email("tigist@hospital.et", "raw-token-123", 5)
    page = html_text(emails[0])
    assert 'href="https://waliin.example/reset-password/raw-token-123"' in page
    assert 'src="https://cdn.example/logo.png"' in page
    assert "#650d2f" in page
    assert "5 minutes" in page


def test_reset_email_shows_the_name_without_a_logo_url(emails, monkeypatch):
    monkeypatch.setattr(settings, "email_logo_url", "")
    email_service.send_password_reset_email("tigist@hospital.et", "raw-token-123", 5)
    page = html_text(emails[0])
    assert "<img" not in page
    assert ">Waliin</span>" in page


def test_reset_email_escapes_the_logo_url(emails, monkeypatch):
    monkeypatch.setattr(
        settings, "email_logo_url", 'https://x.example/a.png" onerror="x'
    )
    email_service.send_password_reset_email("tigist@hospital.et", "raw-token-123", 5)
    assert 'onerror="x' not in html_text(emails[0])


def test_reset_email_can_use_another_app(emails):
    email_service.send_password_reset_email(
        "meron@hospital.et", "raw-token-123", 5, "https://dashboard.example"
    )
    assert "https://dashboard.example/reset-password/raw-token-123" in (
        plain_text(emails[0])
    )


def test_smtp_failure_raises_email_error(monkeypatch):
    monkeypatch.setattr(settings, "email_backend", "smtp")
    monkeypatch.setattr(settings, "smtp_host", "127.0.0.1")
    monkeypatch.setattr(settings, "smtp_port", 9)  # nothing listens here
    with pytest.raises(EmailError):
        email_service.send_email("tigist@hospital.et", "Hello", "Body")
