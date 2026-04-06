"""
Data Import API Routes

This module provides REST endpoints for bulk data import:
- Upload SF7/BEIS exports from DepEd
- Upload STAR training logs from partner universities

The import system uses fuzzy matching to:
- Match teacher names across files (to avoid duplicates)
- Match module names to canonical STAR module list
- Normalize region and subject names to controlled vocabulary

All imports are logged in ImportLog for audit trail.
"""

import json
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.models.models import ImportLog
from app.services.importer import (
    preview_sf7, preview_star_log, confirm_import,
    import_sf7, import_star_log,
)

# Create router with /import prefix
router = APIRouter(prefix="/import", tags=["import"])


# ---------------------------------------------------------------------------
# File Upload Endpoint
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),          # The uploaded file
    source_type: str = Form(...),          # Either "sf7" or "star-log"
    session: Session = Depends(get_session),
):
    """
    Upload and process a bulk import file.

    Accepts two file types:
    - SF7: DepEd School Form 7 exports (teacher master data)
    - star-log: STAR training attendance logs from partner universities

    The file is processed by the appropriate importer function which:
    1. Parses rows from CSV/Excel
    2. Matches/creates teacher records
    3. Creates training records (for star-log)
    4. Logs the import results

    Returns:
        dict: Import summary (filename, rows parsed, imported, flagged)
    """
    # Validate source type
    if source_type not in ("sf7", "star-log"):
        raise HTTPException(400, "source_type must be 'sf7' or 'star-log'")

    # Validate file extension
    if not any(file.filename.endswith(e) for e in (".csv", ".xlsx", ".xls")):
        raise HTTPException(400, "Only CSV or Excel files are accepted")

    # Read file contents
    contents = await file.read()

    # Route to appropriate importer
    log = import_sf7(contents, file.filename, session) \
          if source_type == "sf7" \
          else import_star_log(contents, file.filename, session)

    return {
        "filename":      log.filename,
        "source_type":   log.source_type,
        "rows_parsed":   log.rows_parsed,
        "rows_imported": log.rows_imported,
        "rows_flagged":  log.rows_flagged,
    }


# ---------------------------------------------------------------------------
# Preview Endpoint
# ---------------------------------------------------------------------------

@router.post("/preview")
async def preview_file(
    file: UploadFile = File(...),          # The uploaded file
    source_type: str = Form(...),          # Either "sf7" or "star-log"
):
    """
    Preview file contents without importing.

    Parses the file and returns extracted records for frontend display/editing.
    User can review and modify records before confirming the import.

    Accepts two file types:
    - SF7: DepEd School Form 7 exports (teacher master data)
    - star-log: STAR training attendance logs from partner universities

    Returns:
        dict: {
            source_type: str,
            filename: str,
            total_records: int,
            columns_found: dict,
            records: [...]  // List of extracted records
        }
    """
    # Validate source type
    if source_type not in ("sf7", "star-log"):
        raise HTTPException(400, "source_type must be 'sf7' or 'star-log'")

    # Validate file extension
    if not any(file.filename.endswith(e) for e in (".csv", ".xlsx", ".xls")):
        raise HTTPException(400, "Only CSV or Excel files are accepted")

    # Read file contents
    contents = await file.read()

    # Route to appropriate preview function
    preview = preview_sf7(contents, file.filename) \
              if source_type == "sf7" \
              else preview_star_log(contents, file.filename)

    return preview


# ---------------------------------------------------------------------------
# Confirm Import Endpoint
# ---------------------------------------------------------------------------

@router.post("/confirm")
async def confirm_import_endpoint(
    source_type: str = Form(...),          # Either "sf7" or "star-log"
    records: str = Form(...),              # JSON array of modified records
    session: Session = Depends(get_session),
):
    """
    Confirm import after user reviews/edits records.

    This endpoint receives potentially modified records from the frontend
    (after user review) and saves them to the database.

    Args:
        source_type: Either "sf7" or "star-log"
        records: JSON string containing array of teacher/training records

    Returns:
        dict: Import summary (rows imported, flagged)
    """
    # Validate source type
    if source_type not in ("sf7", "star-log"):
        raise HTTPException(400, "source_type must be 'sf7' or 'star-log'")

    # Parse records JSON
    try:
        records_list = json.loads(records)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON in records parameter")

    if not isinstance(records_list, list):
        raise HTTPException(400, "Records must be a JSON array")

    # Save records to database
    log = confirm_import(records_list, source_type, session)

    return {
        "source_type":   log.source_type,
        "rows_imported": log.rows_imported,
        "rows_flagged":  log.rows_flagged,
    }


# ---------------------------------------------------------------------------
# Import History Endpoint
# ---------------------------------------------------------------------------

@router.get("/logs")
def get_import_logs(session: Session = Depends(get_session)):
    """
    Get import history for the audit trail.

    Returns all ImportLog records, most recent first.
    Used by the Import page to show past uploads.
    """
    logs = session.exec(select(ImportLog).order_by(ImportLog.created_at.desc())).all()
    return [l.dict() for l in logs]