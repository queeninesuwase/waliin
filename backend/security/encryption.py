"""AES-256-GCM encryption for stored secrets such as MFA secrets (security requirement 5.1).

Every value gets a fresh random 96-bit nonce. The key comes from MFA_ENCRYPTION_KEY
and is never stored in the database or the code.

Make a new key:  python -m security.encryption
"""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from config import settings

NONCE_BYTES = 12  # 96 bits


class EncryptionKeyError(RuntimeError):
    """MFA_ENCRYPTION_KEY is missing or not a 32-byte key."""


def new_key():
    """A random 32-byte key, base64-encoded for the .env file."""
    return base64.urlsafe_b64encode(os.urandom(32)).decode()


def _key():
    if not settings.mfa_encryption_key:
        raise EncryptionKeyError("MFA_ENCRYPTION_KEY is not set.")
    key = base64.urlsafe_b64decode(settings.mfa_encryption_key)
    if len(key) != 32:
        raise EncryptionKeyError("MFA_ENCRYPTION_KEY must be 32 bytes (base64).")
    return key


def encrypt_text(plain_text):
    nonce = os.urandom(NONCE_BYTES)
    ciphertext = AESGCM(_key()).encrypt(nonce, plain_text.encode(), None)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode()


def decrypt_text(stored_text):
    data = base64.urlsafe_b64decode(stored_text)
    nonce, ciphertext = data[:NONCE_BYTES], data[NONCE_BYTES:]
    return AESGCM(_key()).decrypt(nonce, ciphertext, None).decode()


if __name__ == "__main__":
    print(f"MFA_ENCRYPTION_KEY={new_key()}")
