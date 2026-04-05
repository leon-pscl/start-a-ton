"""
Data Import Service

This module handles bulk data imports from external sources:
1. SF7/BEIS exports: DepEd's School Form 7 containing teacher profiles
2. STAR training logs: Attendance records from partner universities

The import process:
1. Reads CSV or Excel files using pandas
2. Maps column names to canonical fields using fuzzy matching
3. Normalizes region and subject names to controlled vocabulary
4. Matches existing teachers to avoid duplicates (fuzzy name matching)
5. Creates or updates teacher and training records
6. Logs the import results

Column Mapping:
The importer accepts various column name variations and maps them to
canonical fields. This handles inconsistencies in data exports from
different sources (different DepEd divisions, TEIs, etc.).
"""

from __future__ import annotations
import json, io
from datetime import datetime
from typing import Any
import pandas as pd
from rapidfuzz import fuzz
from sqlmodel import Session, select
from app.models.models import (
    Teacher, TrainingRecord, ImportLog,
    normalize_region, normalize_subject, STAR_MODULES,
)


# ---------------------------------------------------------------------------
# Column Name Mappings
# ---------------------------------------------------------------------------

# SF7 (School Form 7) column name aliases
# Maps various column names to canonical field names
SF7_COLUMN_MAP = {
    "name":                    ["teacher name", "name", "full name", "teacher"],
    "region":                  ["region", "region name"],
    "division":                ["division", "division name", "sdo"],
    "school_name":             ["school", "school name", "school/center"],
    "position":                ["position", "designation", "item"],
    "subject_specializations": ["subject", "subject area", "specialization", "subjects taught"],
    "grade_levels_taught":     ["grade level", "grade", "year level"],
    "school_type":             ["type", "school type", "classification"],
    "training_attended":       ["inset", "tpd", "training", "star training"],
}

# STAR training log column name aliases
# For attendance sheets from partner universities
STAR_LOG_COLUMN_MAP = {
    "name":               ["participant name", "name", "attendee", "full name"],
    "region":             ["region", "region name"],
    "partner_university": ["university", "partner university", "tei", "venue"],
    "module_name":        ["module", "module name", "training", "program"],
    "year":               ["year", "date", "sy", "school year"],
    "school_name":        ["school", "school name"],
    "division":           ["division", "sdo"],
}


# ---------------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------------

def _find_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """
    Find a matching column name from a list of candidates.

    Uses case-insensitive matching to handle variations in column naming.

    Args:
        df: DataFrame to search
        candidates: List of possible column names

    Returns:
        str | None: Matching column name, or None if not found
    """
    # Build lookup with lowercase keys
    normalized = {c.lower().strip(): c for c in df.columns}
    for c in candidates:
        if c.lower() in normalized:
            return normalized[c.lower()]
    return None


def _safe(val: Any) -> str | None:
    """
    Safely extract and clean a value from a DataFrame cell.

    Handles NaN values and strips whitespace.

    Args:
        val: Raw cell value

    Returns:
        str | None: Cleaned string value, or None if empty/NaN
    """
    if pd.isna(val) if not isinstance(val, str) else not val:
        return None
    return str(val).strip()


def _parse_year(val: Any) -> int | None:
    """
    Extract a year value from various formats.

    Handles:
    - Direct year: 2023
    - School year format: "2023-2024", "SY 2023-2024"

    Args:
        val: Raw value containing year

    Returns:
        int | None: Extracted year, or None if not found
    """
    if val is None:
        return None
    # Parse school year format (e.g., "SY 2023-2024")
    for part in str(val).strip().replace("SY", "").split("-"):
        part = part.strip()
        if part.isdigit() and len(part) == 4:
            return int(part)
    return None


def _read_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """
    Read a CSV or Excel file into a DataFrame.

    Args:
        file_bytes: Raw file contents
        filename: Filename (used to determine format)

    Returns:
        pd.DataFrame: Parsed data with all columns as strings
    """
    if filename.endswith(".csv"):
        return pd.read_csv(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)
    # Default to Excel for .xlsx and .xls
    return pd.read_excel(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)


# ---------------------------------------------------------------------------
# Teacher Matching
# ---------------------------------------------------------------------------

def _find_existing(name: str, region: str, session: Session) -> Teacher | None:
    """
    Find an existing teacher by name and region using fuzzy matching.

    This prevents duplicate teacher records when the same person appears
    in multiple imports (e.g., both SF7 and training log).

    Args:
        name: Teacher name to search for
        region: Region to search within
        session: Database session

    Returns:
        Teacher | None: Matching teacher if found (score >= 85), else None
    """
    # Get all teachers in this region as candidates
    candidates = session.exec(select(Teacher).where(Teacher.region == region)).all()
    best, best_score = None, 0

    # Use token sort ratio for fuzzy name matching
    # This handles name variations like "Maria Santos" vs "Santos, Maria"
    for t in candidates:
        score = fuzz.token_sort_ratio(name.lower(), t.full_name.lower())
        if score > best_score:
            best_score, best = score, t

    # Only return if confidence is high enough (85% match)
    return best if best_score >= 85 else None


def _match_module(raw: str) -> str | None:
    """
    Match a training module name to the canonical STAR_MODULES list.

    Uses fuzzy matching to handle variations in module naming.

    Args:
        raw: Raw module name from import

    Returns:
        str | None: Canonical module name if matched (score >= 60), else None
    """
    if not raw:
        return None
    best, best_score = None, 0
    for module in STAR_MODULES:
        score = fuzz.partial_ratio(raw.lower(), module.lower())
        if score > best_score:
            best_score, best = score, module
    return best if best_score >= 60 else None


# ---------------------------------------------------------------------------
# SF7 Import Function
# ---------------------------------------------------------------------------

def import_sf7(file_bytes: bytes, filename: str, session: Session) -> ImportLog:
    """
    Import teacher data from an SF7/BEIS export file.

    SF7 is DepEd's School Form 7, containing teacher master data.
    This import creates/updates teacher records with profile information.

    Args:
        file_bytes: Raw file contents
        filename: Original filename for logging
        session: Database session

    Returns:
        ImportLog: Import results (rows parsed, imported, flagged)
    """
    # Parse the file
    df = _read_file(file_bytes, filename)

    # Create import log entry
    log = ImportLog(filename=filename, source_type="sf7",
                    rows_parsed=len(df), created_at=datetime.utcnow())
    imported, flagged = 0, 0

    # Process each row
    for _, row in df.iterrows():
        # Extract and validate required fields
        name = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["name"]) or ""))
        if not name:
            flagged += 1
            continue

        # Normalize region and subject names
        region_raw = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["region"]) or "", ""))
        region  = normalize_region(region_raw or "")
        subj_raw = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["subject_specializations"]) or "", ""))
        subjects = [normalize_subject(s.strip()) for s in (subj_raw or "").split(",") if s.strip()]

        # Find existing teacher or create new one
        teacher = _find_existing(name, region, session) or Teacher(created_at=datetime.utcnow())

        # Update teacher fields
        teacher.full_name  = name
        teacher.region     = region
        teacher.division   = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["division"]) or "", ""))
        teacher.school_name = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["school_name"]) or "", ""))
        teacher.position   = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["position"]) or "", ""))
        teacher.subject_specializations = json.dumps(subjects) if subjects else None
        teacher.source     = "sf7"
        teacher.data_confidence = 0.85   # SF7 data has high confidence
        teacher.updated_at = datetime.utcnow()

        session.add(teacher)
        imported += 1

    session.commit()

    # Update log with results
    log.rows_imported, log.rows_flagged = imported, flagged
    session.add(log)
    session.commit()

    return log


# ---------------------------------------------------------------------------
# STAR Training Log Import Function
# ---------------------------------------------------------------------------

def import_star_log(file_bytes: bytes, filename: str, session: Session) -> ImportLog:
    """
    Import training attendance from a STAR training log.

    Training logs come from partner universities (TEIs) and contain
    records of which teachers attended which STAR modules.

    Args:
        file_bytes: Raw file contents
        filename: Original filename for logging
        session: Database session

    Returns:
        ImportLog: Import results
    """
    # Parse the file
    df = _read_file(file_bytes, filename)

    # Create import log entry
    log = ImportLog(filename=filename, source_type="star-log",
                    rows_parsed=len(df), created_at=datetime.utcnow())
    imported, flagged = 0, 0

    # Process each row
    for _, row in df.iterrows():
        # Extract and validate required fields
        name = _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["name"]) or ""))
        if not name:
            flagged += 1
            continue

        # Normalize values
        region_raw = _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["region"]) or "", ""))
        region = normalize_region(region_raw or "")
        module_raw = _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["module_name"]) or "", ""))
        module_name = _match_module(module_raw or "")
        year = _parse_year(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["year"]) or ""))
        partner = _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["partner_university"]) or "", ""))

        # Find or create teacher
        teacher = _find_existing(name, region, session)
        if not teacher:
            # Create new teacher from training log (lower confidence)
            teacher = Teacher(
                full_name=name, region=region,
                division=_safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["division"]) or "", "")),
                school_name=_safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["school_name"]) or "", "")),
                source="star-log", data_confidence=0.7,   # Lower confidence for derived data
                created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
            )
            session.add(teacher)
            session.flush()  # Get teacher ID for training record

        # Create training record
        session.add(TrainingRecord(
            teacher_id=teacher.id,
            module_name=module_name or module_raw or "Unknown",
            year=year,
            school_year=f"{year}-{year+1}" if year else None,
            partner_university=partner,
            region=region,
            source="star-log",
            data_confidence=0.8,   # Training data is fairly reliable
        ))
        imported += 1

    session.commit()

    # Update log with results
    log.rows_imported, log.rows_flagged = imported, flagged
    session.add(log)
    session.commit()

    return log