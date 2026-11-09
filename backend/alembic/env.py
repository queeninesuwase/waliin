"""Alembic environment for Waliin.

Reads DATABASE_URL from the environment (.env) and compares the database with
models.Base.metadata (Base comes from database.py). The fault_downtime view is not a table, so it is
skipped here and created by SQL in the migration.
"""

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from database import normalize_database_url
from models import Base  # importing the package registers every model

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

try:  # load .env when python-dotenv is installed
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

database_url = normalize_database_url(os.getenv("DATABASE_URL"))
if not database_url:
    raise RuntimeError("DATABASE_URL is not set (check your .env file)")
config.set_main_option("sqlalchemy.url", database_url)

target_metadata = Base.metadata


def include_object(obj, name, type_, reflected, compare_to):
    # Never let autogenerate touch the view.
    if type_ == "table" and name == "fault_downtime":
        return False
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        include_object=include_object,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
