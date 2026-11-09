import html
import smtplib
from email.message import EmailMessage
from pathlib import Path
from string import Template

from config import settings

TEMPLATES = Path(__file__).resolve().parent.parent / "templates" / "emails"

outbox = []


class EmailError(Exception):
    """The email could not be sent."""


def send_email(to, subject, body, html_body=None):
    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    if html_body is not None:
        message.add_alternative(html_body, subtype="html")

    if settings.email_backend == "memory":
        outbox.append(message)
        return

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as error:
        raise EmailError("Could not send the email.") from error


def send_invitation_email(to, raw_token, hours_valid):
    link = f"{settings.frontend_base_url}/accept-invite?token={raw_token}"
    body = (
        "You have been invited to Waliin.\n\n"
        f"Open this link to set your name and password:\n{link}\n\n"
        f"The link works once and expires in {hours_valid} hours.\n"
        "If you were not expecting this email, you can ignore it."
    )
    html_body = render_template(
        "invitation.html",
        logo=logo_html(),
        link=html.escape(link, quote=True),
        hours=hours_valid,
    )
    send_email(to, "Your Waliin invitation", body, html_body)


def render_template(name, **values):
    template = Template((TEMPLATES / name).read_text(encoding="utf-8"))
    return template.substitute(**values)


def logo_html():
    """The Waliin logo for the top of HTML emails, or the name if no logo URL is set."""
    if settings.email_logo_url:
        url = html.escape(settings.email_logo_url, quote=True)
        return (
            f'<img src="{url}" alt="Waliin" width="140" '
            'style="display: block; width: 140px; height: auto; border: 0" />'
        )
    return (
        '<span style="font-size: 28px; font-weight: bold; color: #ffffff">Waliin</span>'
    )


def send_password_reset_email(to, raw_token, minutes_valid, base_url=None):
    link = f"{base_url or settings.frontend_base_url}/reset-password/{raw_token}"
    html_body = render_template(
        "password_reset.html",
        logo=logo_html(),
        link=html.escape(link, quote=True),
        minutes=minutes_valid,
    )
    body = (
        "We received a request to reset the password of your Waliin account.\n\n"
        f"Open this link to choose a new password:\n{link}\n\n"
        f"The link works once and expires in {minutes_valid} minutes.\n"
        "If you did not ask for this, you can ignore this email; "
        "your password stays the same."
    )
    send_email(to, "Reset your Waliin password", body, html_body)
