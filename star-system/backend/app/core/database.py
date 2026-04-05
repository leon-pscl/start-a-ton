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