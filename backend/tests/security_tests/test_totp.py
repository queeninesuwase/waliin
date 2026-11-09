"""Tests for security/totp.py (authenticator app codes, RFC 6238)."""

from security.totp import (
    code_at,
    matching_step,
    new_secret,
    provisioning_uri,
    time_step,
)

# The RFC 6238 test secret ("12345678901234567890" in base32).
RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"


def test_code_matches_rfc_test_vector():
    # RFC 6238: at 59 seconds the SHA-1 code is 94287082; we use the last 6 digits.
    assert code_at(RFC_SECRET, time_step(59)) == "287082"


def test_new_secret_is_random_base32():
    first, second = new_secret(), new_secret()
    assert first != second
    assert len(first) == 32
    assert set(first) <= set("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567")


def test_current_code_is_accepted():
    now = 1_700_000_000
    code = code_at(RFC_SECRET, time_step(now))
    assert matching_step(RFC_SECRET, code, now) == time_step(now)


def test_one_step_of_clock_drift_is_accepted():
    now = 1_700_000_000
    previous = code_at(RFC_SECRET, time_step(now) - 1)
    following = code_at(RFC_SECRET, time_step(now) + 1)
    assert matching_step(RFC_SECRET, previous, now) == time_step(now) - 1
    assert matching_step(RFC_SECRET, following, now) == time_step(now) + 1


def test_old_code_is_refused():
    now = 1_700_000_000
    old = code_at(RFC_SECRET, time_step(now) - 2)
    assert matching_step(RFC_SECRET, old, now) is None


def test_code_cannot_be_used_twice():
    now = 1_700_000_000
    code = code_at(RFC_SECRET, time_step(now))
    used_step = matching_step(RFC_SECRET, code, now)
    assert matching_step(RFC_SECRET, code, now, last_used_step=used_step) is None


def test_badly_formed_codes_are_refused():
    for code in ("", "12345", "1234567", "abcdef"):
        assert matching_step(RFC_SECRET, code, 1_700_000_000) is None


def test_provisioning_uri_for_the_qr_code():
    uri = provisioning_uri(RFC_SECRET, "abebe@hospital.et", "Waliin")
    assert uri.startswith("otpauth://totp/Waliin%3Aabebe%40hospital.et?")
    assert f"secret={RFC_SECRET}" in uri
    assert "issuer=Waliin" in uri
    assert "digits=6" in uri
    assert "period=30" in uri
