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
    normalize_region, normalize_subject, normalize_city, STAR_MODULES,
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
    "subject_specializations":     ["subject", "subject area", "specialization", "subjects taught"],
    "subjects_currently_teaching": ["subjects teaching", "currently teaching", "subjects currently taught"],
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
# SF7 File Parser (DepEd School Form 7)
# ---------------------------------------------------------------------------

def _parse_sf7_file(file_bytes: bytes, filename: str) -> tuple[dict, list[dict]]:
    """
    Parse DepEd SF7 (School Form 7) Excel file.

    SF7 file structure:
    - Row 5, Col H: Region
    - Row 7, Col D: School Name (merged cells D-H)
    - Rows 18-19: Column headers
    - Row 20+: Teacher data

    Column positions (0-indexed):
    - Col 1: Name
    - Col 2: Sex
    - Col 5: Position
    - Col 7: Degree (Educational Qualification)
    - Col 8: Major/Specialization
    - Col 12: Subject Taught

    Args:
        file_bytes: Raw file contents
        filename: Original filename

    Returns:
        tuple: (school_info dict, list of teacher dicts)
    """
    from openpyxl import load_workbook
    import io

    # Load workbook
    wb = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    ws = wb.active

    # Extract school metadata from specific cells
    # Row 5, Col H (index 7) = Region
    # Row 7, Col D (index 3) = School Name (merged cells)
    region_raw = ws.cell(row=5, column=8).value  # H5
    school_name = ws.cell(row=7, column=4).value  # D7

    school_info = {
        "region": normalize_region(str(region_raw or "")),
        "school_name": str(school_name).strip() if school_name else None,
    }

    # Extract teacher data starting from row 20
    teachers = []
    for row in ws.iter_rows(min_row=20, values_only=True):
        # Column indices (0-based): Name=1, Sex=2, Position=5, Degree=7, Major=8, Subject=12
        name = row[1] if len(row) > 1 else None
        if not name or not isinstance(name, str) or not name.strip():
            continue

        sex = row[2] if len(row) > 2 else None
        position = row[5] if len(row) > 5 else None
        degree = row[7] if len(row) > 7 else None
        major = row[8] if len(row) > 8 else None
        subject = row[12] if len(row) > 12 else None

        teacher = {
            "name": str(name).strip(),
            "sex": str(sex).strip() if sex else None,
            "position": str(position).strip() if position else None,
            "degree": str(degree).strip() if degree else None,
            "major": str(major).strip() if major else None,
            "subject": str(subject).strip() if subject else None,
        }
        teachers.append(teacher)

    wb.close()
    return school_info, teachers


# ---------------------------------------------------------------------------
# SF7 Preview Function
# ---------------------------------------------------------------------------

def preview_sf7(file_bytes: bytes, filename: str) -> dict:
    """
    Preview SF7 file contents without importing.

    Parses the file and returns extracted records for frontend display/editing.
    Uses the specialized SF7 parser that handles DepEd's specific format.

    Args:
        file_bytes: Raw file contents
        filename: Original filename for logging

    Returns:
        dict: { source_type, filename, total_records, school_info, records: [...] }
    """
    records = []
    columns_found = {}

    # Determine file type and parse accordingly
    if filename.endswith(('.xlsx', '.xls')):
        # Use specialized SF7 parser for Excel files
        school_info, teachers = _parse_sf7_file(file_bytes, filename)
        columns_found = {"name": "Column B", "position": "Column F", "degree": "Column H", "subject": "Column M"}

        for idx, teacher in enumerate(teachers, 1):
            # Parse subjects (may be comma-separated)
            subjects = []
            if teacher.get("subject"):
                subjects = [normalize_subject(s.strip()) for s in teacher["subject"].split(",") if s.strip()]

            # Map degree to highest_qualification
            degree = teacher.get("degree")
            qual = None
            if degree:
                deg_lower = degree.lower()
                if "phd" in deg_lower or "doctor" in deg_lower:
                    qual = "PhD"
                elif "med" in deg_lower or "master" in deg_lower:
                    qual = "MEd"
                elif "bs" in deg_lower or "bachelor" in deg_lower or "ab" in deg_lower:
                    qual = "BSEd"
                else:
                    qual = degree

            record = {
                "_idx": idx,
                "full_name": teacher["name"],
                "region": school_info["region"],
                "school_name": school_info["school_name"],
                "position": teacher.get("position"),
                "highest_qualification": qual,
                "subject_specializations": subjects,
                "subjects_currently_teaching": [],
                "grade_levels_taught": [],
                "trainings_attended": [],
                "low_confidence_subjects": [],
                "unapplied_modules": [],
                "distance_to_training": None,
                "preferred_format": None,
                "province": None,
                "city": None,
                "division": None,
                "school_type": "public",
                "years_experience": None,
            }
            records.append(record)
    else:
        # CSV fallback - use generic parser
        df = _read_file(file_bytes, filename)

        for field, aliases in SF7_COLUMN_MAP.items():
            col = _find_column(df, aliases)
            if col:
                columns_found[field] = col

        for idx, row in df.iterrows():
            name = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["name"]) or ""))
            if not name:
                continue

            region_raw = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["region"]) or ""))
            subj_raw = _safe(row.get(_find_column(df, SF7_COLUMN_MAP["subject_specializations"]) or ""))
            subjects = [normalize_subject(s.strip()) for s in (subj_raw or "").split(",") if s.strip()]

            record = {
                "_idx": idx + 1,
                "full_name": name,
                "region": normalize_region(region_raw or ""),
                "division": _safe(row.get(_find_column(df, SF7_COLUMN_MAP["division"]) or "")),
                "school_name": _safe(row.get(_find_column(df, SF7_COLUMN_MAP["school_name"]) or "")),
                "position": _safe(row.get(_find_column(df, SF7_COLUMN_MAP["position"]) or "")),
                "subject_specializations": subjects,
                "subjects_currently_teaching": [],
                "grade_levels_taught": [],
                "school_type": _safe(row.get(_find_column(df, SF7_COLUMN_MAP["school_type"]) or "")) or "public",
                "province": None,
                "city": None,
                "years_experience": None,
                "highest_qualification": None,
                "trainings_attended": [],
                "low_confidence_subjects": [],
                "unapplied_modules": [],
                "distance_to_training": None,
                "preferred_format": None,
            }
            records.append(record)

    return {
        "source_type": "sf7",
        "filename": filename,
        "total_records": len(records),
        "columns_found": columns_found,
        "school_info": columns_found.get("school_name") if not filename.endswith(('.xlsx', '.xls')) else None,
        "records": records,
    }


# ---------------------------------------------------------------------------
# STAR Training Log Preview Function
# ---------------------------------------------------------------------------

def preview_star_log(file_bytes: bytes, filename: str) -> dict:
    """
    Preview STAR training log contents without importing.

    Parses the file and returns extracted records for frontend display/editing.

    Args:
        file_bytes: Raw file contents
        filename: Original filename for logging

    Returns:
        dict: { source_type, filename, total_records, records: [...] }
    """
    df = _read_file(file_bytes, filename)
    records = []
    columns_found = {}

    # Detect which columns were found
    for field, aliases in STAR_LOG_COLUMN_MAP.items():
        col = _find_column(df, aliases)
        if col:
            columns_found[field] = col

    for idx, row in df.iterrows():
        name = _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["name"]) or ""))
        if not name:
            continue

        region_raw = _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["region"]) or ""))
        module_raw = _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["module_name"]) or ""))
        year = _parse_year(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["year"]) or ""))
        partner = _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["partner_university"]) or ""))

        record = {
            "_idx": idx + 1,
            "full_name": name,
            "region": normalize_region(region_raw or ""),
            "division": _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["division"]) or "")),
            "school_name": _safe(row.get(_find_column(df, STAR_LOG_COLUMN_MAP["school_name"]) or "")),
            # Training-specific fields
            "module_detected": _match_module(module_raw) or module_raw,
            "module_raw": module_raw,
            "year": year,
            "partner_university": partner,
            # Fields not in training log - will be empty for user to fill
            "province": None,
            "city": None,
            "school_type": "public",
            "position": None,
            "years_experience": None,
            "highest_qualification": None,
            "subject_specializations": [],
            "subjects_currently_teaching": [],
            "grade_levels_taught": [],
            "trainings_attended": [_match_module(module_raw)] if _match_module(module_raw) else [],
            "low_confidence_subjects": [],
            "unapplied_modules": [],
            "distance_to_training": None,
            "preferred_format": None,
        }
        records.append(record)

    return {
        "source_type": "star-log",
        "filename": filename,
        "total_records": len(records),
        "columns_found": columns_found,
        "records": records,
    }


# ---------------------------------------------------------------------------
# Confirm Import Function
# ---------------------------------------------------------------------------

def confirm_import(records: list[dict], source_type: str, session: Session) -> ImportLog:
    """
    Save confirmed/modified records to database.

    This is called after the user reviews and potentially edits the preview data.

    Args:
        records: List of teacher/training record dictionaries (potentially modified by user)
        source_type: Either "sf7" or "star-log"
        session: Database session

    Returns:
        ImportLog: Import results
    """
    log = ImportLog(
        filename=f"confirmed-{source_type}",
        source_type=source_type,
        rows_parsed=len(records),
        created_at=datetime.utcnow(),
    )
    imported, flagged = 0, 0

    for record in records:
        name = record.get("full_name", "").strip()
        if not name:
            flagged += 1
            continue

        region = normalize_region(record.get("region") or "")

        # Find existing teacher or create new one
        teacher = _find_existing(name, region, session) or Teacher(created_at=datetime.utcnow())

        # Update teacher fields from record
        teacher.full_name = name
        teacher.region = region
        teacher.province = record.get("province")
        teacher.city = normalize_city(record.get("city")) if record.get("city") else None
        teacher.division = record.get("division")
        teacher.school_name = record.get("school_name")
        teacher.school_type = record.get("school_type") or "public"
        teacher.position = record.get("position")
        teacher.years_experience = record.get("years_experience")
        teacher.highest_qualification = record.get("highest_qualification")

        # Handle JSON array fields
        subjects = record.get("subject_specializations")
        teacher.subject_specializations = json.dumps(subjects) if subjects else None

        currently = record.get("subjects_currently_teaching")
        teacher.subjects_currently_teaching = json.dumps(currently) if currently else None

        grades = record.get("grade_levels_taught")
        teacher.grade_levels_taught = json.dumps(grades) if grades else None

        low_conf = record.get("low_confidence_subjects")
        teacher.low_confidence_subjects = json.dumps(low_conf) if low_conf else None

        unapplied = record.get("unapplied_modules")
        teacher.unapplied_modules = json.dumps(unapplied) if unapplied else None

        teacher.distance_to_training = record.get("distance_to_training")
        teacher.preferred_format = record.get("preferred_format")
        teacher.source = source_type
        teacher.data_confidence = 0.85 if source_type == "sf7" else 0.7
        teacher.updated_at = datetime.utcnow()

        session.add(teacher)
        imported += 1

        # For STAR-log, also create training records
        if source_type == "star-log":
            trainings = record.get("trainings_attended", [])
            for module_name in trainings:
                if module_name:
                    # Check if this training record already exists
                    existing = session.exec(
                        select(TrainingRecord).where(
                            TrainingRecord.teacher_id == teacher.id,
                            TrainingRecord.module_name == module_name,
                        )
                    ).first()
                    if not existing:
                        session.add(TrainingRecord(
                            teacher_id=teacher.id,
                            module_name=module_name,
                            year=record.get("year"),
                            partner_university=record.get("partner_university"),
                            region=region,
                            source="star-log",
                            data_confidence=0.8,
                        ))

    session.commit()

    log.rows_imported = imported
    log.rows_flagged = flagged
    session.add(log)
    session.commit()

    return log


# ---------------------------------------------------------------------------
# Legacy Import Functions (for backward compatibility)
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
    # Use preview + confirm for consistency
    preview = preview_sf7(file_bytes, filename)
    return confirm_import(preview["records"], "sf7", session)


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
    # Use preview + confirm for consistency
    preview = preview_star_log(file_bytes, filename)
    return confirm_import(preview["records"], "star-log", session)