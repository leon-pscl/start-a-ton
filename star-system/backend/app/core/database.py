"""
Database Configuration Module

This module provides the core database infrastructure for the STAR system:
- Database engine creation and configuration
- Session management for database operations
- Table initialization on startup

The default database is SQLite (star.db) for development simplicity,
but can be switched to PostgreSQL or other databases via DATABASE_URL.
"""

from sqlmodel import SQLModel, create_engine, Session
from typing import Generator
from pathlib import Path
import os
from sqlalchemy import text, inspect

# ---------------------------------------------------------------------------
# Database Connection Configuration
# ---------------------------------------------------------------------------

# Determine the base directory (project root) for database file location
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Database URL configuration with SQLite as the default
# Can be overridden with DATABASE_URL environment variable for production
# Example PostgreSQL URL: postgresql://user:pass@localhost/star_db
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/star.db")

# Create the database engine with connection pooling
# SQLite-specific: check_same_thread=False allows multi-threaded access
# (SQLite by default only allows connections from the thread that created it)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False,  # Set to True for SQL query logging during debugging
)


# ---------------------------------------------------------------------------
# Database Initialization
# ---------------------------------------------------------------------------

def init_db():
    """
    Initialize the database schema.

    Creates all tables defined in SQLModel metadata (models that inherit from
    SQLModel with table=True). This is called once on application startup.

    This uses SQLModel's metadata.create_all() which is idempotent - it won't
    recreate tables that already exist.
    """
    SQLModel.metadata.create_all(engine)

    # Lightweight SQLite migration for existing development databases.
    # This keeps the app working when new columns are added to SQLModel tables
    # without requiring the user to delete star.db manually.
    if not DATABASE_URL.startswith("sqlite"):
        return

    inspector = inspect(engine)
    if "teacher" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("teacher")}
    required_columns = {
        "degree_program": "TEXT",
        "primary_specialization": "TEXT",
        "graduation_year": "INTEGER",
        "preferred_relocation_regions": "TEXT",
        "preferred_relocation_type": "TEXT",
        "last_training_year": "INTEGER",
    }

    missing_columns = {
        name: column_type for name, column_type in required_columns.items() if name not in existing_columns
    }
    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing_columns.items():
            connection.execute(text(f'ALTER TABLE teacher ADD COLUMN {column_name} {column_type}'))

    if "graduation_year" in missing_columns:
        connection.execute(
            text(
                "UPDATE teacher SET graduation_year = CAST(strftime('%Y', 'now') AS INTEGER) - years_experience - 4 "
                "WHERE graduation_year IS NULL AND years_experience IS NOT NULL"
            )
        )


# ---------------------------------------------------------------------------
# Session Management
# ---------------------------------------------------------------------------

def get_session() -> Generator[Session, None, None]:
    """
    FastAPI dependency for database session management.

    Yields a database session that is automatically closed after the request.
    This follows the dependency injection pattern recommended by FastAPI/SQLModel.

    Usage in route handlers:
        @app.get("/items/")
        def get_items(session: Session = Depends(get_session)):
            return session.exec(select(Item)).all()

    Yields:
        Session: An active SQLModel database session

    The session is automatically cleaned up after the request completes,
    ensuring proper connection management.
    """
    with Session(engine) as session:
        yield session