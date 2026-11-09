from datetime import datetime, timedelta, timezone

from security.tokens import (
    INVITATION_LIFETIME,
    RESET_LIFETIME,
    expiry_from_now,
    hash_token,
    is_expired,
    new_token,
    token_matches,
)

NOW = datetime(2026, 10, 24, 9, 0, tzinfo=timezone.utc)


def test_new_token_is_long_and_random():
    raw_one, _ = new_token()
    raw_two, _ = new_token()
    assert len(raw_one) >= 43
    assert raw_one != raw_two


def test_only_the_hash_is_returned_for_saving():
    raw, stored = new_token()
    assert stored == hash_token(raw)
    assert raw not in stored


def test_hash_is_sha256_hex():
    stored = hash_token("abc")
    assert len(stored) == 64
    assert stored == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


def test_right_token_matches():
    raw, stored = new_token()
    assert token_matches(raw, stored) is True


def test_wrong_token_does_not_match():
    _, stored = new_token()
    other, _ = new_token()
    assert token_matches(other, stored) is False


def test_missing_token_or_hash_does_not_match():
    raw, stored = new_token()
    assert token_matches("", stored) is False
    assert token_matches(raw, None) is False


def test_invitation_lasts_72_hours():
    assert INVITATION_LIFETIME == timedelta(hours=72)
    assert expiry_from_now(INVITATION_LIFETIME, now=NOW) == NOW + timedelta(hours=72)


def test_reset_link_lasts_5_minutes():
    assert RESET_LIFETIME == timedelta(minutes=5)


def test_token_is_valid_before_expiry():
    expires = expiry_from_now(RESET_LIFETIME, now=NOW)
    assert is_expired(expires, now=NOW + timedelta(minutes=4)) is False


def test_token_is_expired_at_expiry_time():
    expires = expiry_from_now(RESET_LIFETIME, now=NOW)
    assert is_expired(expires, now=NOW + timedelta(minutes=5)) is True


def test_token_without_expiry_is_expired():
    assert is_expired(None, now=NOW) is True
