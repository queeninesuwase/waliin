from database import normalize_database_url


def test_heroku_postgres_url_uses_psycopg():
    assert (
        normalize_database_url("postgres://u:p@host:5432/db")
        == "postgresql+psycopg://u:p@host:5432/db"
    )


def test_plain_postgresql_url_uses_psycopg():
    assert (
        normalize_database_url("postgresql://u:p@host/db")
        == "postgresql+psycopg://u:p@host/db"
    )


def test_psycopg_url_is_kept():
    url = "postgresql+psycopg://u:p@localhost:5432/waliin_dev"
    assert normalize_database_url(url) == url


def test_empty_url_is_kept():
    assert normalize_database_url(None) is None
