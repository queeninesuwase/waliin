from config import Settings


def test_session_defaults_follow_the_security_requirements():
    settings = Settings(_env_file=None)
    assert settings.session_idle_minutes == 15
    assert settings.session_max_hours == 8


def test_session_cookie_uses_the_host_prefix():
    assert Settings(_env_file=None).session_cookie_name.startswith("__Host-")


def test_settings_can_come_from_the_environment(monkeypatch):
    monkeypatch.setenv("SESSION_IDLE_MINUTES", "5")
    assert Settings(_env_file=None).session_idle_minutes == 5
