import pytest
from argon2 import PasswordHasher

from security.passwords import (
    PasswordPolicyError,
    check_password_policy,
    hash_password,
    needs_rehash,
    verify_dummy_password,
    verify_password,
)

GOOD_PASSWORD = "maternity ward monitor"


def test_long_password_is_accepted():
    check_password_policy(GOOD_PASSWORD)


def test_short_password_is_refused():
    with pytest.raises(PasswordPolicyError):
        check_password_policy("short pass1")


def test_twelve_characters_is_accepted():
    check_password_policy("abcdefgh1234")


def test_very_long_password_is_refused():
    with pytest.raises(PasswordPolicyError):
        check_password_policy("a" * 129)


def test_common_password_is_refused():
    with pytest.raises(PasswordPolicyError):
        check_password_policy("Password1234")


def test_password_same_as_email_is_refused():
    with pytest.raises(PasswordPolicyError):
        check_password_policy("meron@hospital.et", email="Meron@hospital.et")


def test_no_symbols_are_required():
    check_password_policy("onlylettersandspaces here")


def test_hash_uses_argon2id_with_required_settings():
    stored = hash_password(GOOD_PASSWORD)
    assert stored.startswith("$argon2id$v=19$m=65536,t=3,p=4$")


def test_hash_does_not_contain_the_password():
    assert GOOD_PASSWORD not in hash_password(GOOD_PASSWORD)


def test_same_password_gives_different_hashes():
    assert hash_password(GOOD_PASSWORD) != hash_password(GOOD_PASSWORD)


def test_hash_fits_the_password_hash_column():
    assert len(hash_password("x" * 128)) <= 255


def test_right_password_is_accepted():
    stored = hash_password(GOOD_PASSWORD)
    assert verify_password(stored, GOOD_PASSWORD) is True


def test_wrong_password_is_refused():
    stored = hash_password(GOOD_PASSWORD)
    assert verify_password(stored, "maternity ward monitoR") is False


def test_empty_stored_hash_is_refused():
    assert verify_password(None, GOOD_PASSWORD) is False


def test_broken_stored_hash_is_refused():
    assert verify_password("not-a-real-hash", GOOD_PASSWORD) is False


def test_unknown_email_check_always_fails():
    assert verify_dummy_password(GOOD_PASSWORD) is False


def test_current_hash_does_not_need_rehash():
    assert needs_rehash(hash_password(GOOD_PASSWORD)) is False


def test_weaker_old_hash_needs_rehash():
    weak = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1).hash(
        GOOD_PASSWORD
    )
    assert needs_rehash(weak) is True
    assert verify_password(weak, GOOD_PASSWORD) is True
