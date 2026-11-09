"""Time-based one-time codes for authenticator apps (RFC 6238, security requirement 5.1, MFA).

6 digits, a new code every 30 seconds, a 160-bit secret, and one step of clock
drift accepted on either side.
"""

import base64
import hashlib
import hmac
import secrets
import struct
from urllib.parse import quote

STEP_SECONDS = 30
DIGITS = 6
SECRET_BYTES = 20  # 160 bits


def new_secret():
    """A random secret in base32, the format authenticator apps expect."""
    return base64.b32encode(secrets.token_bytes(SECRET_BYTES)).decode().rstrip("=")


def _secret_bytes(secret):
    padding = "=" * (-len(secret) % 8)
    return base64.b32decode(secret.upper() + padding)


def time_step(unix_seconds):
    return int(unix_seconds // STEP_SECONDS)


def code_at(secret, step):
    """The 6-digit code for one time step."""
    digest = hmac.new(
        _secret_bytes(secret), struct.pack(">Q", step), hashlib.sha1
    ).digest()
    offset = digest[-1] & 0x0F
    number = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(number % 10**DIGITS).zfill(DIGITS)


def matching_step(secret, code, unix_seconds, last_used_step=None):
    """Return the time step the code belongs to, or None if it is wrong.

    A step at or before last_used_step is refused, so a code cannot be used twice.
    """
    code = code.strip()
    if len(code) != DIGITS or not code.isdigit():
        return None
    current = time_step(unix_seconds)
    for step in (current - 1, current, current + 1):
        if last_used_step is not None and step <= last_used_step:
            continue
        if hmac.compare_digest(code_at(secret, step), code):
            return step
    return None


def provisioning_uri(secret, account, issuer):
    """The otpauth:// link the frontend shows as a QR code."""
    label = quote(f"{issuer}:{account}")
    return (
        f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}"
        f"&digits={DIGITS}&period={STEP_SECONDS}"
    )
