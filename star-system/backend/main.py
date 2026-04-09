"""
STAR Integrated Data System - Main Application Entry Point

This module initializes the FastAPI application for the DOST-SEI Science Teacher
Academy for the Regions (STAR) program. It provides the central API for:
- Teacher profile management
- Training record tracking
- Gap score analytics
- Data import from external sources (SF7, training logs)

The application uses:
- FastAPI for REST API framework
- SQLModel for ORM/database interactions
- SQLite as the default database (configurable via DATABASE_URL)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import init_db
from app.api import teachers, analytics, imports, chat

# ---------------------------------------------------------------------------
# Application Configuration
# ---------------------------------------------------------------------------

# Create the FastAPI application instance with metadata for API documentation
app = FastAPI(
    title="STAR Integrated Data System",
    description="DOST-SEI Science Teacher Academy for the Regions — Teacher Profile & Analytics API",
    version="1.0.0",
)

# Configure CORS to allow requests from any origin
# This enables the frontend to communicate with the API from different domains
# In production, you may want to restrict this to specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Allow all origins (restrict in production)
    allow_credentials=True,        # Allow cookies/auth headers
    allow_methods=["*"],           # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],           # Allow all headers
)


# ---------------------------------------------------------------------------
# Startup Event Handler
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup():
    """
    Initialize the database on application startup.

    Creates all tables defined in the SQLModel metadata if they don't exist.
    This ensures the database schema is ready before handling requests.
    """
    init_db()


# ---------------------------------------------------------------------------
# API Route Registration
# ---------------------------------------------------------------------------

# Include API routers for different resource domains
# Each router handles a specific area of functionality
app.include_router(teachers.router)    # Teacher CRUD operations
app.include_router(analytics.router)   # Gap score analytics and reporting
app.include_router(imports.router)     # Data import endpoints (SF7, training logs)
app.include_router(chat.router)         # AI chatbot endpoint


# ---------------------------------------------------------------------------
# Root Endpoint
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    """
    Root endpoint providing API metadata and navigation.

    Returns basic information about the system and a link to the
    interactive API documentation (Swagger UI at /docs).
    """
    return {
        "system": "STAR Integrated Data System",
        "version": "1.0.0",
        "docs": "/docs",
    }